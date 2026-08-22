#!/usr/bin/env python3
"""gen_docs_index.py 的单元测试。只用标准库 unittest，无需装依赖。

用法：python3 scripts/docs/test_gen_docs_index.py
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gen_docs_index import (  # noqa: E402
    BEGIN,
    END,
    Adr,
    ParseError,
    apply,
    collect,
    render,
    run,
)

ADR_BODY = """# {id}. {title}

- 状态：{status}
- 索引：{index}
- 日期：2026-08-22

## 背景

略。
"""

INDEX_SKELETON = f"""# docs/adr/

前言。

## 索引

{BEGIN}
{END}

## 尾注

尾部内容应被保留。
"""


def write_adr(adr_dir: Path, adr_id: str, slug: str, **kw) -> Path:
    path = adr_dir / f"{adr_id}-{slug}.md"
    path.write_text(
        ADR_BODY.format(
            id=adr_id,
            title=kw.get("title", "某个结论"),
            status=kw.get("status", "已接受"),
            index=kw.get("index", "一句话摘要"),
        ),
        encoding="utf-8",
    )
    return path


class TempAdrDir(unittest.TestCase):
    """每个用例一个干净的临时 ADR 目录。"""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.adr_dir = Path(self._tmp.name)
        (self.adr_dir / "AGENTS.md").write_text(INDEX_SKELETON, encoding="utf-8")
        self.addCleanup(self._tmp.cleanup)

    @property
    def index_text(self) -> str:
        return (self.adr_dir / "AGENTS.md").read_text(encoding="utf-8")


class TestCollect(TempAdrDir):
    def test_reads_fields_and_strips_id_prefix_from_title(self):
        write_adr(self.adr_dir, "20260101000001", "alpha",
                  title="标题里带 ID 前缀", status="已接受", index="摘要 A")
        [adr] = collect(self.adr_dir)
        self.assertEqual(adr.adr_id, "20260101000001")
        self.assertEqual(adr.slug, "alpha")
        self.assertEqual(adr.title, "标题里带 ID 前缀")  # "20260101000001. " 已剥离
        self.assertEqual(adr.status, "已接受")
        self.assertEqual(adr.index, "摘要 A")

    def test_sorted_by_id_ascending(self):
        write_adr(self.adr_dir, "20260101000003", "c")
        write_adr(self.adr_dir, "20260101000001", "a")
        write_adr(self.adr_dir, "20260101000002", "b")
        self.assertEqual([a.slug for a in collect(self.adr_dir)], ["a", "b", "c"])

    def test_skips_index_and_template(self):
        write_adr(self.adr_dir, "20260101000001", "alpha")
        (self.adr_dir / "TEMPLATE.md").write_text("# 模板\n\n无字段\n", encoding="utf-8")
        # AGENTS.md 已由 setUp 建好，也应被跳过
        self.assertEqual(len(collect(self.adr_dir)), 1)

    def test_empty_dir_yields_empty_list(self):
        self.assertEqual(collect(self.adr_dir), [])

    def test_index_value_may_contain_fullwidth_colon(self):
        write_adr(self.adr_dir, "20260101000001", "alpha",
                  index="前缀：含全角冒号的摘要：还有第二个")
        [adr] = collect(self.adr_dir)
        self.assertEqual(adr.index, "前缀：含全角冒号的摘要：还有第二个")

    # ── 错误路径 ────────────────────────────────────────────────
    def test_missing_index_field_raises(self):
        p = self.adr_dir / "20260101000001-alpha.md"
        p.write_text("# 20260101000001. 标题\n\n- 状态：已接受\n", encoding="utf-8")
        with self.assertRaises(ParseError) as cm:
            collect(self.adr_dir)
        self.assertIn("索引", str(cm.exception))

    def test_missing_status_field_raises(self):
        p = self.adr_dir / "20260101000001-alpha.md"
        p.write_text("# 20260101000001. 标题\n\n- 索引：摘要\n", encoding="utf-8")
        with self.assertRaises(ParseError) as cm:
            collect(self.adr_dir)
        self.assertIn("状态", str(cm.exception))

    def test_missing_title_raises(self):
        p = self.adr_dir / "20260101000001-alpha.md"
        p.write_text("- 状态：已接受\n- 索引：摘要\n", encoding="utf-8")
        with self.assertRaises(ParseError) as cm:
            collect(self.adr_dir)
        self.assertIn("一级标题", str(cm.exception))

    def test_bad_filename_raises(self):
        write_adr(self.adr_dir, "20260101000001", "ok")
        (self.adr_dir / "not-an-adr.md").write_text(
            "# 标题\n\n- 状态：已接受\n- 索引：摘要\n", encoding="utf-8"
        )
        with self.assertRaises(ParseError) as cm:
            collect(self.adr_dir)
        self.assertIn("文件名不符合", str(cm.exception))

    def test_all_errors_reported_at_once(self):
        """多个问题应一次全报，避免修一个跑一次。"""
        (self.adr_dir / "bad-name-one.md").write_text("# x\n", encoding="utf-8")
        (self.adr_dir / "20260101000001-alpha.md").write_text(
            "# 20260101000001. 标题\n\n- 状态：已接受\n", encoding="utf-8"
        )
        with self.assertRaises(ParseError) as cm:
            collect(self.adr_dir)
        msg = str(cm.exception)
        self.assertIn("文件名不符合", msg)
        self.assertIn("索引", msg)

    def test_duplicate_id_raises(self):
        write_adr(self.adr_dir, "20260101000001", "alpha")
        write_adr(self.adr_dir, "20260101000001", "beta")
        with self.assertRaises(ParseError) as cm:
            collect(self.adr_dir)
        self.assertIn("重复", str(cm.exception))


class TestRender(unittest.TestCase):
    def _adr(self, **kw) -> Adr:
        base = dict(adr_id="20260101000001", slug="alpha", title="标题",
                    status="已接受", index="摘要")
        base.update(kw)
        return Adr(**base)  # type: ignore[arg-type]

    def test_includes_markers_and_count(self):
        out = render([self._adr()])
        self.assertTrue(out.startswith(BEGIN))
        self.assertTrue(out.endswith(END))
        self.assertIn("共 1 份", out)

    def test_zero_adrs_renders_valid_empty_table(self):
        out = render([])
        self.assertIn("共 0 份", out)
        self.assertIn("| ID | 结论 | 状态 | 索引 |", out)

    def test_link_points_at_real_filename(self):
        out = render([self._adr(adr_id="20260101000009", slug="my-slug")])
        self.assertIn("(./20260101000009-my-slug.md)", out)

    def test_pipe_in_content_is_escaped(self):
        """未转义的竖线会把一行截成多列，表格结构塌掉。"""
        out = render([self._adr(title="A | B", index="X | Y")])
        self.assertIn("A \\| B", out)
        self.assertIn("X \\| Y", out)
        # 每行的列数应仍为 4（首尾各一个边界竖线 → 5 个分隔符）
        row = [l for l in out.splitlines() if l.startswith("| [`")][0]
        self.assertEqual(row.count("|") - row.count("\\|"), 5)

    def test_newline_in_content_is_flattened(self):
        out = render([self._adr(index="第一行\n第二行")])
        self.assertIn("第一行 第二行", out)
        self.assertNotIn("第一行\n第二行", out)


class TestApply(unittest.TestCase):
    def test_replaces_between_markers_and_keeps_surroundings(self):
        doc = f"HEAD\n{BEGIN}\nold\n{END}\nTAIL\n"
        out = apply(doc, f"{BEGIN}\nnew\n{END}")
        self.assertIn("HEAD", out)
        self.assertIn("TAIL", out)
        self.assertIn("new", out)
        self.assertNotIn("old", out)

    def test_idempotent(self):
        doc = f"HEAD\n{BEGIN}\nold\n{END}\nTAIL\n"
        block = f"{BEGIN}\nnew\n{END}"
        self.assertEqual(apply(apply(doc, block), block), apply(doc, block))

    def test_missing_begin_raises(self):
        with self.assertRaises(ParseError):
            apply(f"HEAD\n{END}\n", f"{BEGIN}\nx\n{END}")

    def test_missing_end_raises(self):
        with self.assertRaises(ParseError):
            apply(f"HEAD\n{BEGIN}\n", f"{BEGIN}\nx\n{END}")

    def test_reversed_markers_raise(self):
        with self.assertRaises(ParseError) as cm:
            apply(f"{END}\nmid\n{BEGIN}\n", f"{BEGIN}\nx\n{END}")
        self.assertIn("错序", str(cm.exception))


class TestRun(TempAdrDir):
    def test_generates_then_reports_in_sync(self):
        write_adr(self.adr_dir, "20260101000001", "alpha", index="摘要 A")

        code, msg = run(self.adr_dir, check_only=False)
        self.assertEqual(code, 0, msg)
        self.assertIn("已更新", msg)
        self.assertIn("摘要 A", self.index_text)

        # 再跑一次应报「已同步」且不改动文件
        before = self.index_text
        code, msg = run(self.adr_dir, check_only=False)
        self.assertEqual(code, 0)
        self.assertIn("同步", msg)
        self.assertEqual(self.index_text, before)

    def test_check_detects_out_of_sync_without_writing(self):
        write_adr(self.adr_dir, "20260101000001", "alpha")
        run(self.adr_dir, check_only=False)

        # 新增一份但不重新生成 → --check 必须报不同步
        write_adr(self.adr_dir, "20260101000002", "beta")
        before = self.index_text
        code, msg = run(self.adr_dir, check_only=True)
        self.assertEqual(code, 1)
        self.assertIn("不同步", msg)
        self.assertEqual(self.index_text, before, "--check 不该改文件")

    def test_check_detects_tampered_table_body(self):
        write_adr(self.adr_dir, "20260101000001", "alpha", index="真摘要")
        run(self.adr_dir, check_only=False)

        path = self.adr_dir / "AGENTS.md"
        path.write_text(self.index_text.replace("真摘要", "被篡改"), encoding="utf-8")

        code, _ = run(self.adr_dir, check_only=True)
        self.assertEqual(code, 1, "手改表体应被检出")

    def test_preserves_content_outside_markers(self):
        write_adr(self.adr_dir, "20260101000001", "alpha")
        run(self.adr_dir, check_only=False)
        text = self.index_text
        self.assertIn("前言。", text)
        self.assertIn("尾部内容应被保留。", text)

    def test_missing_index_file_fails(self):
        (self.adr_dir / "AGENTS.md").unlink()
        code, msg = run(self.adr_dir, check_only=False)
        self.assertEqual(code, 1)
        self.assertIn("索引文件不存在", msg)

    def test_parse_error_fails_without_writing(self):
        write_adr(self.adr_dir, "20260101000001", "alpha")
        run(self.adr_dir, check_only=False)
        before = self.index_text

        (self.adr_dir / "20260101000002-broken.md").write_text(
            "# 20260101000002. 无字段\n", encoding="utf-8"
        )
        code, msg = run(self.adr_dir, check_only=False)
        self.assertEqual(code, 1)
        self.assertIn("解析失败", msg)
        self.assertEqual(self.index_text, before, "解析失败时不该写入部分结果")

    def test_status_change_alone_triggers_out_of_sync(self):
        """只改 ADR 的状态字段也必须被 --check 抓到——前向指针机制依赖这一点。"""
        path = write_adr(self.adr_dir, "20260101000001", "alpha", status="已接受")
        run(self.adr_dir, check_only=False)

        path.write_text(
            path.read_text(encoding="utf-8").replace(
                "- 状态：已接受", "- 状态：被 20260101000002 取代"
            ),
            encoding="utf-8",
        )
        code, _ = run(self.adr_dir, check_only=True)
        self.assertEqual(code, 1)


class TestRealRepoInSync(unittest.TestCase):
    """本仓库真实的 docs/adr 必须是同步状态——等价于 CI 的 --check。"""

    def test_repo_index_in_sync(self):
        adr_dir = Path(__file__).resolve().parents[2] / "docs" / "adr"
        if not adr_dir.exists():
            self.skipTest("未在仓库内运行")
        code, msg = run(adr_dir, check_only=True)
        self.assertEqual(code, 0, msg)


if __name__ == "__main__":
    unittest.main(verbosity=2)
