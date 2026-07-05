"""Template matcher — rank layout templates by relevance to current run."""

from __future__ import annotations

import json
from typing import Any

from app.chains._json_utils import parse_json_object
from app.config import settings


def run_template_matcher(input_data: dict[str, Any]) -> dict[str, Any]:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    templates = input_data.get("templates", [])
    if not templates:
        raise RuntimeError("template_matcher requires templates")

    from langchain_community.chat_models.tongyi import ChatTongyi
    from langchain_core.messages import HumanMessage

    prompt = _build_prompt(input_data)
    llm = ChatTongyi(
        model=settings.llm_model_fast,
        dashscope_api_key=settings.dashscope_api_key,
        temperature=0.1,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    result = parse_json_object(content)
    _normalize_ranked(result, templates)
    return result


def _normalize_ranked(result: dict[str, Any], templates: list[dict[str, Any]]) -> None:
    valid_ids = {str(t.get("id", "")) for t in templates if t.get("id")}
    ranked = result.get("ranked")
    if not isinstance(ranked, list):
        result["ranked"] = []
        return

    cleaned: list[dict[str, Any]] = []
    seen: set[str] = set()
    for entry in ranked:
        if not isinstance(entry, dict):
            continue
        template_id = str(entry.get("templateId", "")).strip()
        if not template_id or template_id in seen or template_id not in valid_ids:
            continue
        score = entry.get("score", 0)
        try:
            score_int = int(score)
        except (TypeError, ValueError):
            score_int = 0
        cleaned.append({
            "templateId": template_id,
            "score": max(0, min(100, score_int)),
            "reason": str(entry.get("reason", "")).strip(),
        })
        seen.add(template_id)
        if len(cleaned) >= 3:
            break

    if len(cleaned) < min(3, len(valid_ids)):
        for t in templates:
            tid = str(t.get("id", ""))
            if tid and tid not in seen:
                cleaned.append({
                    "templateId": tid,
                    "score": int(t.get("qualityScore", 70) or 70),
                    "reason": "fallback by library order",
                })
                seen.add(tid)
            if len(cleaned) >= 3:
                break

    result["ranked"] = cleaned[:3]


def _build_prompt(input_data: dict[str, Any]) -> str:
    writer = json.dumps(input_data.get("writer", {}), ensure_ascii=False)
    editor = json.dumps(input_data.get("editor", {}), ensure_ascii=False)
    templates = json.dumps(input_data.get("templates", []), ensure_ascii=False)
    item_count = input_data.get("itemCount", 0)

    return f"""你是公众号排版模板匹配专家。根据本期选题与成稿，从模板库中评估**相关性**，输出最合适的 Top3。

## 评估维度（各 0-100，综合为 score）
1. 文章类型匹配（daily_digest / 资讯条数区间）
2. 结构匹配（板块数、是否有 SVG 交互需求）
3. 主题/tag 相似（editor.outline 与模板 tags）
4. 语气与体量（writer 字数、资讯密度）

## 输出（只输出 JSON）
{{
  "ranked": [
    {{"templateId": "模板UUID", "score": 92, "reason": "一句话说明为何适配"}},
    {{"templateId": "...", "score": 85, "reason": "..."}},
    {{"templateId": "...", "score": 78, "reason": "..."}}
  ]
}}

## 规则
- ranked 必须 3 条（库不足 3 条则全部返回），templateId 必须来自输入 templates
- score 为整数 0-100，理由具体可执行
- 优先推荐 hasSvg=true 的模板当本期是「日报合集」且需精美交互时

本期资讯条数（估算）：{item_count}

模板库（仅元数据，无 HTML）：
{templates}

Editor：
{editor}

Writer：
{writer}
"""
