"""Ranker chain — select Top N AI news for WeChat digest."""

from __future__ import annotations

import json
from typing import Any

from app.config import settings


def run_ranker(input_data: dict[str, Any]) -> dict[str, Any]:
    articles = input_data.get("articles", [])
    top_n = int(input_data.get("topN", 10))

    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    from langchain_community.chat_models.tongyi import ChatTongyi
    from langchain_core.messages import HumanMessage

    prompt = _build_rank_prompt(articles, top_n)
    llm = ChatTongyi(
        model=settings.llm_model_fast,
        dashscope_api_key=settings.dashscope_api_key,
        temperature=0.2,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    parsed = _parse_json(content)
    items = parsed.get("items", [])
    return {"items": items[:top_n]}


def _build_rank_prompt(articles: list[dict[str, Any]], top_n: int) -> str:
    compact = json.dumps(articles[:120], ensure_ascii=False)
    return f"""你是 AI 资讯编辑。从下列采集文章中选出最适合中文 AI 公众号日报的 Top {top_n} 条。

要求：
1. 只输出 JSON，不要 markdown 代码块
2. 格式：{{"items":[{{"url":"","title":"","score":0.0,"reason":"","source":""}}]}}
3. score 范围 0-1，代表推荐度
4. 优先近期、高质量、与 AI/ML 强相关的内容
5. sourceCategory 为 company/papers 的官方与论文动态优先；cn_media 中文源保留优质条目
6. 同一事件只保留 1 条，避免重复报道
7. 结合 publishedAt 优先 48 小时内内容

文章列表：
{compact}
"""


def _parse_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
    return json.loads(text)
