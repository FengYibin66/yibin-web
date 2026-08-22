#!/usr/bin/env python3
"""生成 docs/adr/AGENTS.md 的 ADR 索引表。

索引表是生成物，不要手改表体。人只维护每份 ADR 头部的 `- 状态：` 与 `- 索引：` 字段。

用法：
    python3 scripts/docs/gen_docs_index.py           # 重新生成
    python3 scripts/docs/gen_docs_index.py --check   # 只校验是否同步（CI 用，不写文件）

退出码：0 同步 / 1 不同步或解析失败。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ADR_DIR = REPO_ROOT / "docs" / "adr"
TARGET = ADR_DIR / "AGENTS.md"

BEGIN = "<!-- BEGIN:adr-index (生成物，勿手改；见 scripts/docs/gen_docs_index.py) -->"
END = "<!-- END:adr-index -->"

# 文件名形如 20260822120801-some-slug.md
ADR_NAME = re.compile(r"^(?P<id>\d{14})-(?P<slug>[a-z0-9-]+)\.md$")


class ParseError(Exception):
    pass


def field(body: str, label: str, path: Path) -> str:
    """取形如 `- 标签：值` 的字段值，允许值内含全角冒号。"""
    m = re.search(rf"^-\s*{label}：\s*(?P<val>.+?)\s*$", body, re.MULTILINE)
    if not m:
        raise ParseError(f"{path.name}: 缺少 `- {label}：` 字段")
    return m.group("val").strip()


def title(body: str, path: Path) -> str:
    m = re.search(r"^#\s+(?P<t>.+?)\s*$", body, re.MULTILINE)
    if not m:
        raise ParseError(f"{path.name}: 缺少一级标题")
    # 去掉标题开头的 "<ID>. " 前缀，表格里 ID 已单独成列
    return re.sub(r"^\d{14}\.\s*", "", m.group("t")).strip()


def cell(text: str) -> str:
    """转义表格单元格：竖线会截断列，换行会截断行。"""
    return text.replace("|", "\\|").replace("\n", " ")


def collect() -> list[tuple[str, str, str, str]]:
    rows: list[tuple[str, str, str, str]] = []
    errors: list[str] = []
    for path in sorted(ADR_DIR.glob("*.md")):
        if path.name in ("AGENTS.md", "TEMPLATE.md"):
            continue
        m = ADR_NAME.match(path.name)
        if not m:
            errors.append(f"{path.name}: 文件名不符合 <14位时间戳>-<kebab-slug>.md")
            continue
        body = path.read_text(encoding="utf-8")
        try:
            rows.append((m.group("id"), title(body, path),
                         field(body, "状态", path), field(body, "索引", path)))
        except ParseError as exc:
            errors.append(str(exc))
    if errors:
        raise ParseError("\n".join(errors))
    return rows


def render(rows: list[tuple[str, str, str, str]]) -> str:
    lines = [BEGIN, "", f"共 {len(rows)} 份。按 ID（创建时间）升序。", "",
             "| ID | 结论 | 状态 | 索引 |", "|----|------|------|------|"]
    for adr_id, t, status, index in rows:
        lines.append(f"| [`{adr_id}`](./{adr_id}-{slug_of(adr_id)}.md) "
                     f"| {cell(t)} | {cell(status)} | {cell(index)} |")
    lines += ["", END]
    return "\n".join(lines)


def slug_of(adr_id: str) -> str:
    for path in ADR_DIR.glob(f"{adr_id}-*.md"):
        m = ADR_NAME.match(path.name)
        if m:
            return m.group("slug")
    raise ParseError(f"找不到 ID {adr_id} 对应的文件")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="只校验同步，不写文件")
    args = ap.parse_args()

    if not TARGET.exists():
        print(f"[错误] 目标不存在：{TARGET.relative_to(REPO_ROOT)}", file=sys.stderr)
        return 1

    try:
        block = render(collect())
    except ParseError as exc:
        print(f"[错误] ADR 解析失败：\n{exc}", file=sys.stderr)
        return 1

    current = TARGET.read_text(encoding="utf-8")
    if BEGIN not in current or END not in current:
        print(f"[错误] {TARGET.name} 缺少 BEGIN/END 标记，无法定位索引块", file=sys.stderr)
        return 1

    head, _, rest = current.partition(BEGIN)
    _, _, tail = rest.partition(END)
    updated = head + block + tail

    if updated == current:
        print(f"[同步] ADR 索引已是最新（{len(collect())} 份）")
        return 0

    if args.check:
        print("[不同步] ADR 索引与实际不一致。"
              "运行 `python3 scripts/docs/gen_docs_index.py` 重新生成。", file=sys.stderr)
        return 1

    TARGET.write_text(updated, encoding="utf-8")
    print(f"[已更新] {TARGET.relative_to(REPO_ROOT)}（{len(collect())} 份）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
