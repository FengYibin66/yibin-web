"""Editor chain — topic selection and outline from Top 10 digest."""

from __future__ import annotations

import json
from typing import Any

from app.chains._digest_tags import TAG_TAXONOMY_HINT
from app.chains._json_utils import parse_json_object
from app.config import settings


def run_editor(input_data: dict[str, Any]) -> dict[str, Any]:
    items = input_data.get("items", [])
    if not items:
        raise RuntimeError("editor requires digest items")

    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    from langchain_community.chat_models.tongyi import ChatTongyi
    from langchain_core.messages import HumanMessage

    prompt = _build_prompt(items)
    llm = ChatTongyi(
        model=settings.llm_model_smart,
        dashscope_api_key=settings.dashscope_api_key,
        temperature=0.5,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    return parse_json_object(content)


def _build_prompt(items: list[dict[str, Any]]) -> str:
    compact = json.dumps(items, ensure_ascii=False)
    return f"""你是 AI 公众号主编。基于下列 Top 资讯，确定今日选题并输出结构化大纲。

要求：
1. 只输出 JSON，不要 markdown 代码块
2. 文章类型优先「AI 日报合集」，从 Top 10 中精选 5-8 条组织成一篇
3. 必须利用每条资讯的 tags 字段分板块组稿：
   - 先按 tags 聚类（同标签合并到同一板块）
   - outline 中除「导语」外，每个 heading 应对应一个主要标签/主题（如「大模型」「Agent」「融资」）
   - 无 tags 的条目归入「其他动态」
   - 参考标签体系：{TAG_TAXONOMY_HINT}
4. 格式：
{{
  "articleType": "daily_digest",
  "topic": "今日 AI 要闻速览",
  "angle": "一句话选题角度",
  "outline": [
    {{"heading": "导语", "bullets": ["今日要闻概览"]}},
    {{"heading": "大模型", "tag": "大模型", "bullets": ["标题或 url，对应素材"]}},
    {{"heading": "Agent", "tag": "Agent", "bullets": ["..."]}}
  ],
  "selectedUrls": ["https://..."]
}}
5. selectedUrls 必须与 outline 中引用的素材一致

输入资讯（含 tags、summaryZh）：
{compact}
"""
