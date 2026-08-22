#!/usr/bin/env python3
"""生成 docs/adr/AGENTS.md 的 ADR 索引表。

索引表是生成物，不要手改表体。人只维护每份 ADR 头部的 `- 状态：` 与 `- 索引：` 字段。

用法：
    python3 scripts/docs/gen_docs_index.py           # 重新生成
    python3 scripts/docs/gen_docs_index.py --check   # 只校验是否同步（CI 用，不写文件）

退出码：0 同步 / 1 不同步或解析失败。

核心逻辑（collect / render / apply）不碰文件系统之外的全局状态，且接受目录参数，
便于单测在临时目录里构造夹具——见 scripts/docs/test_gen_docs_index.py。
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ADR_DIRNAME = Path("docs") / "adr"
INDEX_FILENAME = "AGENTS.md"

BEGIN = "<!-- BEGIN:adr-index (生成物，勿手改；见 scripts/docs/gen_docs_index.py) -->"
END = "<!-- END:adr-index -->"

# 文件名形如 20260822120801-some-slug.md
ADR_NAME = re.compile(r"^(?P<id>\d{14})-(?P<slug>[a-z0-9-]+)\.md$")

# 这两个文件在 ADR 目录里但不是 ADR
NON_ADR = frozenset({INDEX_FILENAME, "TEMPLATE.md"})


class ParseError(Exception):
    """ADR 内容或命名不合规。"""


@dataclass(frozen=True)
class Adr:
    adr_id: str
    slug: str
    title: str
    status: str
    index: str

    @property
    def filename(self) -> str:
        return f"{self.adr_id}-{self.slug}.md"


def _field(body: str, label: str, name: str) -> str:
    """取形如 `- 标签：值` 的字段值，允许值内含全角冒号。"""
    m = re.search(rf"^-\s*{label}：\s*(?P<val>.+?)\s*$", body, re.MULTILINE)
    if not m:
        raise ParseError(f"{name}: 缺少 `- {label}：` 字段")
    return m.group("val").strip()


def _title(body: str, name: str) -> str:
    m = re.search(r"^#\s+(?P<t>.+?)\s*$", body, re.MULTILINE)
    if not m:
        raise ParseError(f"{name}: 缺少一级标题")
    # 去掉标题开头的 "<ID>. " 前缀，表格里 ID 已单独成列
    return re.sub(r"^\d{14}\.\s*", "", m.group("t")).strip()


def _cell(text: str) -> str:
    """转义表格单元格：竖线会截断列，换行会截断行。"""
    return text.replace("|", "\\|").replace("\n", " ")


def collect(adr_dir: Path) -> list[Adr]:
    """读出目录里全部 ADR，按 ID 升序。所有不合规项一次性报出，不逐个中断。"""
    adrs: list[Adr] = []
    errors: list[str] = []

    for path in sorted(adr_dir.glob("*.md")):
        if path.name in NON_ADR:
            continue
        m = ADR_NAME.match(path.name)
        if not m:
            errors.append(f"{path.name}: 文件名不符合 <14位时间戳>-<kebab-slug>.md")
            continue
        body = path.read_text(encoding="utf-8")
        try:
            adrs.append(
                Adr(
                    adr_id=m.group("id"),
                    slug=m.group("slug"),
                    title=_title(body, path.name),
                    status=_field(body, "状态", path.name),
                    index=_field(body, "索引", path.name),
                )
            )
        except ParseError as exc:
            errors.append(str(exc))

    if errors:
        raise ParseError("\n".join(errors))

    # 同一 ID 出现两次说明有人复制了文件名前缀，索引会出现重复行 → 视为错误
    seen: dict[str, str] = {}
    for adr in adrs:
        if adr.adr_id in seen:
            raise ParseError(
                f"ID {adr.adr_id} 重复：{seen[adr.adr_id]} 与 {adr.filename}"
            )
        seen[adr.adr_id] = adr.filename

    return adrs


def render(adrs: list[Adr]) -> str:
    """渲染索引块（含 BEGIN/END 标记）。slug 来自 collect，无需再查文件系统。"""
    lines = [
        BEGIN,
        "",
        f"共 {len(adrs)} 份。按 ID（创建时间）升序。",
        "",
        "| ID | 结论 | 状态 | 索引 |",
        "|----|------|------|------|",
    ]
    for adr in adrs:
        lines.append(
            f"| [`{adr.adr_id}`](./{adr.filename}) "
            f"| {_cell(adr.title)} | {_cell(adr.status)} | {_cell(adr.index)} |"
        )
    lines += ["", END]
    return "\n".join(lines)


def apply(current: str, block: str) -> str:
    """把 block 替换进 current 的 BEGIN/END 之间。标记缺失或错序时报错。"""
    begin_at = current.find(BEGIN)
    end_at = current.find(END)
    if begin_at == -1 or end_at == -1:
        raise ParseError(f"索引文件缺少 {'BEGIN' if begin_at == -1 else 'END'} 标记，无法定位索引块")
    if end_at < begin_at:
        raise ParseError("索引文件的 END 标记出现在 BEGIN 之前，标记错序")

    head = current[:begin_at]
    tail = current[end_at + len(END):]
    return head + block + tail


def run(adr_dir: Path, check_only: bool) -> tuple[int, str]:
    """返回 (退出码, 面向人的一行说明)。不直接打印，便于单测断言。"""
    index_path = adr_dir / INDEX_FILENAME
    if not index_path.exists():
        return 1, f"[错误] 索引文件不存在：{index_path}"

    try:
        adrs = collect(adr_dir)
        block = render(adrs)
        current = index_path.read_text(encoding="utf-8")
        updated = apply(current, block)
    except ParseError as exc:
        return 1, f"[错误] ADR 解析失败：\n{exc}"

    if updated == current:
        return 0, f"[同步] ADR 索引已是最新（{len(adrs)} 份）"

    if check_only:
        return 1, (
            "[不同步] ADR 索引与实际不一致。"
            "运行 `python3 scripts/docs/gen_docs_index.py` 重新生成。"
        )

    index_path.write_text(updated, encoding="utf-8")
    return 0, f"[已更新] {index_path}（{len(adrs)} 份）"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--check", action="store_true", help="只校验同步，不写文件")
    ap.add_argument(
        "--adr-dir",
        type=Path,
        default=REPO_ROOT / ADR_DIRNAME,
        help="ADR 目录（默认仓库内 docs/adr，单测会指向临时目录）",
    )
    args = ap.parse_args(argv)

    code, message = run(args.adr_dir, args.check)
    print(message, file=sys.stderr if code else sys.stdout)
    return code


if __name__ == "__main__":
    sys.exit(main())
