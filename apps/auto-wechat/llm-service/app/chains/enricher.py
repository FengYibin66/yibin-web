"""Enricher chain — add Chinese summary for ranked items."""

from __future__ import annotations

import json
from typing import Any

from app.chains._digest_tags import TAG_TAXONOMY_HINT
from app.config import settings


def run_enricher(input_data: dict[str, Any]) -> dict[str, Any]:
    items = input_data.get("items", [])
    if not items:
        return {"items": []}

    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    from langchain_community.chat_models.tongyi import ChatTongyi
    from langchain_core.messages import HumanMessage

    prompt = _build_enrich_prompt(items)
    llm = ChatTongyi(
        model=settings.llm_model_fast,
        dashscope_api_key=settings.dashscope_api_key,
        temperature=0.3,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    parsed = _parse_json(content)
    return {"items": parsed.get("items", items)}


def _build_enrich_prompt(items: list[dict[str, Any]]) -> str:
    compact = json.dumps(items, ensure_ascii=False)
    return f"""你是 AI 资讯编辑。为下列 Top 资讯生成中文摘要 enrichment。

要求：
1. 只输出 JSON，不要 markdown 代码块
2. 格式：{{"items":[{{"url":"","title":"","score":0.0,"reason":"","summary":"","summaryZh":"中文摘要2-3句","tags":["标签"],"source":""}}]}}
3. 保留原有 url/title/score，不要改顺序
4. summaryZh 面向中文读者，简洁专业
5. 每条必须包含 tags 数组，至少 1 个标签；优先从下列分类选择（可组合 1-2 个）：
   {TAG_TAXONOMY_HINT}
6. tags 将用于后续日报分板块组稿，请准确反映资讯主题

输入：
{compact}
"""


def _parse_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
    return json.loads(text)
