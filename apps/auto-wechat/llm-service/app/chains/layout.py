"""Layout chain — few-shot full-page imitation from Top3 templates."""

from __future__ import annotations

import json
from typing import Any

from app.chains._json_utils import parse_json_object
from app.chains._layout_constraints import LAYOUT_FEWSHOT_CONSTRAINTS
from app.chains._tongyi import create_chat_tongyi
from app.config import layout_model_name, settings


def _create_layout_llm(*, temperature: float):
    return create_chat_tongyi(
        model=layout_model_name(),
        temperature=temperature,
        max_tokens=settings.llm_max_output_tokens_layout,
        streaming=True,
    )


def run_layout(input_data: dict[str, Any]) -> dict[str, Any]:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    mode = input_data.get("mode", "template_fewshot")
    if mode == "blocks_fallback":
        return _run_layout_blocks_fallback(input_data)

    templates = input_data.get("templates", [])
    if not templates:
        return _run_layout_blocks_fallback(input_data)

    from langchain_core.messages import HumanMessage

    prompt = _build_fewshot_prompt(input_data)
    llm = _create_layout_llm(temperature=0.2)
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    return parse_json_object(content)


def _build_fewshot_prompt(input_data: dict[str, Any]) -> str:
    writer = json.dumps(input_data.get("writer", {}), ensure_ascii=False)
    editor = json.dumps(input_data.get("editor", {}), ensure_ascii=False)
    images = json.dumps(input_data.get("images", []), ensure_ascii=False)
    illustrations = json.dumps(input_data.get("illustrations", {}), ensure_ascii=False)
    feedback = input_data.get("feedback", "")
    feedback_block = f"\n\n排版修改意见（必须落实）：\n{feedback}" if feedback else ""
    template_match = json.dumps(input_data.get("templateMatch", {}), ensure_ascii=False)

    templates_payload = []
    for idx, tmpl in enumerate(input_data.get("templates", [])[:3]):
        entry = {
            "rank": idx + 1,
            "id": tmpl.get("id"),
            "name": tmpl.get("name"),
            "description": tmpl.get("description"),
            "articleType": tmpl.get("articleType"),
            "tags": tmpl.get("tags"),
            "hasSvg": tmpl.get("hasSvg"),
        }
        if idx == 0:
            entry["bodyHtml"] = tmpl.get("bodyHtml")
        else:
            entry["structureNote"] = "辅模板：仅参考风格与标签，勿拼接；全文 HTML 已省略以控制上下文长度"
        templates_payload.append(entry)
    templates_json = json.dumps(templates_payload, ensure_ascii=False)

    return f"""你是微信公众号排版专家。采用 **Few-shot 整页仿写**：参照模板库 Top3 全文 HTML，将本期内容填入模板槽位，输出可直接发布的 bodyHtml。

{LAYOUT_FEWSHOT_CONSTRAINTS}

## 模板匹配结果（供你确认主模板）
{template_match}

## 模板 Top3 全文（templates[0] 为主模板）
{templates_json}

## 本期内容

Editor（选题大纲）：
{editor}

Writer（成稿）：
{writer}

可用图片：
{images}

配图（illustrate 步骤产出；须将 slots / bySourceUrl 中的 URL 写入对应 `<image href>` 或 `<img src>`，禁止删 tag）：
{illustrations}{feedback_block}
"""


def _run_layout_blocks_fallback(input_data: dict[str, Any]) -> dict[str, Any]:
    """Fallback when template library is empty — blocks planner path."""
    from app.chains._layout_example import BLOCKS_EXAMPLE

    from langchain_core.messages import HumanMessage

    writer = json.dumps(input_data.get("writer", {}), ensure_ascii=False)
    editor = json.dumps(input_data.get("editor", {}), ensure_ascii=False)
    images = json.dumps(input_data.get("images", []), ensure_ascii=False)
    illustrations = json.dumps(input_data.get("illustrations", {}), ensure_ascii=False)
    example = json.dumps(BLOCKS_EXAMPLE, ensure_ascii=False, indent=2)

    prompt = f"""模板库为空，回退 blocks 模式。输出 blocks JSON（不要 bodyHtml）。

标杆：
{example}

Editor：{editor}
Writer：{writer}
Images：{images}
Illustrations：{illustrations}
"""
    llm = _create_layout_llm(temperature=0.15)
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    return parse_json_object(content)
