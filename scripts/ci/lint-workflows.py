#!/usr/bin/env python3
"""校验 GitHub Actions workflow 的接线，而非其中脚本的逻辑。

存在的理由：`gate` job 曾把汇总逻辑从内联 YAML 抽成 `scripts/ci/evaluate-gate.sh`
以便本地可测，但没补 `actions/checkout` —— 结果 CI 上 exit 127
（"No such file or directory"）。`gate-test.sh` 测的是脚本逻辑，测不到接线；
本脚本补的正是这一层。

当前检查项：

  C1  job 的 run 引用了仓库内的文件，但该 job 没有 checkout 步骤
  C2  gate job 的 needs 与它实际传给 evaluate-gate.sh 的 job 名不一致
      （漏传一个 job = 那个 job 失败也不会拦住合入）
  C3  引用的仓库脚本路径实际不存在（写错路径 / 改名后忘了同步）

用法：
    python3 scripts/ci/lint-workflows.py           # 校验，问题则 rc=1
    python3 scripts/ci/lint-workflows.py --self-test  # 跑内置用例
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover
    print("[错误] 需要 PyYAML：pip3 install pyyaml", file=sys.stderr)
    raise SystemExit(1)

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_DIR = REPO_ROOT / ".github" / "workflows"

# run 里出现的仓库相对路径。只认这几个已知的脚本目录，避免把 `pnpm --filter x build`
# 之类的普通命令误判成文件引用。
REPO_PATH = re.compile(
    r"(?<![\w./-])((?:scripts|\.claude)/[A-Za-z0-9._/-]+\.(?:sh|py|mjs|js))"
)

CHECKOUT = "actions/checkout"


def load_workflows(workflow_dir: Path) -> dict[str, dict]:
    """读出目录下所有 workflow。YAML 1.1 会把裸 `on` 解析成 True，这里不关心它。"""
    out: dict[str, dict] = {}
    for path in sorted(workflow_dir.glob("*.y*ml")):
        out[path.name] = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return out


def job_steps(job: dict) -> list[dict]:
    steps = job.get("steps") or []
    return [s for s in steps if isinstance(s, dict)]


def has_checkout(job: dict) -> bool:
    return any(CHECKOUT in str(s.get("uses", "")) for s in job_steps(job))


def referenced_repo_paths(job: dict) -> set[str]:
    found: set[str] = set()
    for step in job_steps(job):
        run = step.get("run")
        if isinstance(run, str):
            found.update(REPO_PATH.findall(run))
    return found


def check_checkout_present(name: str, jobs: dict) -> list[str]:
    """C1 + C3。"""
    problems: list[str] = []
    for job_id, job in jobs.items():
        if not isinstance(job, dict):
            continue
        paths = referenced_repo_paths(job)
        if not paths:
            continue

        if not has_checkout(job):
            listed = ", ".join(sorted(paths))
            problems.append(
                f"{name} → job `{job_id}`：run 引用了仓库文件（{listed}）"
                f"但没有 {CHECKOUT} 步骤。CI 上会是 exit 127 "
                f'（"No such file or directory"）。'
            )

        for rel in sorted(paths):
            if not (REPO_ROOT / rel).exists():
                problems.append(
                    f"{name} → job `{job_id}`：引用的 `{rel}` 在仓库里不存在"
                )
    return problems


def check_gate_covers_all_needs(name: str, jobs: dict) -> list[str]:
    """C2：gate 传给 evaluate-gate.sh 的 job 名必须与 needs 完全一致。

    漏传一个 = 那个 job 失败也不会拦住合入，而这不会有任何症状。
    """
    problems: list[str] = []
    for job_id, job in jobs.items():
        if not isinstance(job, dict):
            continue
        runs = " ".join(
            s["run"] for s in job_steps(job) if isinstance(s.get("run"), str)
        )
        if "evaluate-gate.sh" not in runs:
            continue

        needs = job.get("needs") or []
        if isinstance(needs, str):
            needs = [needs]
        declared = set(needs)

        # 形如 "resume-e2e:${{ needs.resume-e2e.result }}"
        passed = set(re.findall(r'"([A-Za-z0-9_-]+):\$\{\{', runs))

        missing = declared - passed
        extra = passed - declared

        if missing:
            problems.append(
                f"{name} → job `{job_id}`：needs 里有 {sorted(missing)} "
                f"但没传给 evaluate-gate.sh。那些 job 失败时门禁不会拦。"
            )
        if extra:
            problems.append(
                f"{name} → job `{job_id}`：传给 evaluate-gate.sh 的 {sorted(extra)} "
                f"不在 needs 里，其结果恒为空 → 门禁恒失败。"
            )
    return problems


def lint(workflow_dir: Path = WORKFLOW_DIR) -> list[str]:
    problems: list[str] = []
    for name, doc in load_workflows(workflow_dir).items():
        jobs = doc.get("jobs") or {}
        problems += check_checkout_present(name, jobs)
        problems += check_gate_covers_all_needs(name, jobs)
    return problems


# ── 内置用例 ────────────────────────────────────────────────────────
SELF_TESTS: list[tuple[str, str, bool]] = [
    (
        "引用脚本但缺 checkout → 应报错",
        """
jobs:
  gate:
    steps:
      - name: Evaluate
        run: bash scripts/ci/evaluate-gate.sh "changes:x"
""",
        False,
    ),
    (
        "引用脚本且有 checkout → 应通过",
        """
jobs:
  gate:
    steps:
      - uses: actions/checkout@v4
      - name: Evaluate
        run: bash scripts/ci/evaluate-gate.sh "changes:x"
""",
        True,
    ),
    (
        "不引用仓库文件、无 checkout → 应通过（不误报）",
        """
jobs:
  build:
    steps:
      - run: pnpm --filter @yibin/resume build
""",
        True,
    ),
    (
        "gate 漏传一个 needs → 应报错",
        """
jobs:
  gate:
    needs: [alpha, beta]
    steps:
      - uses: actions/checkout@v4
      - run: |
          bash scripts/ci/evaluate-gate.sh "alpha:${{ needs.alpha.result }}"
""",
        False,
    ),
    (
        "gate 传了不在 needs 里的名字 → 应报错",
        """
jobs:
  gate:
    needs: [alpha]
    steps:
      - uses: actions/checkout@v4
      - run: |
          bash scripts/ci/evaluate-gate.sh "alpha:${{ needs.alpha.result }}" "ghost:${{ needs.ghost.result }}"
""",
        False,
    ),
    (
        "gate 传全 needs → 应通过",
        """
jobs:
  gate:
    needs: [alpha, beta-two]
    steps:
      - uses: actions/checkout@v4
      - run: |
          bash scripts/ci/evaluate-gate.sh "alpha:${{ needs.alpha.result }}" "beta-two:${{ needs.beta-two.result }}"
""",
        True,
    ),
]


def self_test() -> int:
    import tempfile

    passed = failed = 0
    for label, body, should_pass in SELF_TESTS:
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "fixture.yml").write_text(body, encoding="utf-8")
            # 只看 checkout/needs 两类问题，忽略夹具里路径不存在的报错
            problems = [p for p in lint(d) if "在仓库里不存在" not in p]
            ok = (len(problems) == 0) == should_pass
            if ok:
                print(f"  ✅ {label}")
                passed += 1
            else:
                print(f"  ❌ {label} — 实际问题：{problems or '无'}")
                failed += 1

    print(f"\n通过 {passed} / 失败 {failed}")
    return 0 if failed == 0 else 1


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--self-test", action="store_true", help="跑内置用例")
    args = ap.parse_args(argv)

    if args.self_test:
        return self_test()

    problems = lint()
    if problems:
        print("[workflow 接线问题]", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    print("[通过] workflow 接线检查无问题")
    return 0


if __name__ == "__main__":
    sys.exit(main())
