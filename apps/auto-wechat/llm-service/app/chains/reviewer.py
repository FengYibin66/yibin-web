"""Reviewer chain — content and layout quality check."""

from __future__ import annotations

import json
from typing import Any

from app.chains._json_utils import parse_json_object
from app.config import settings


def run_reviewer(input_data: dict[str, Any]) -> dict[str, Any]:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    from langchain_community.chat_models.tongyi import ChatTongyi
    from langchain_core.messages import HumanMessage

    prompt = _build_prompt(input_data)
    llm = ChatTongyi(
        model=settings.llm_model_fast,
        dashscope_api_key=settings.dashscope_api_key,
        temperature=0.2,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    return parse_json_object(content)


def _build_prompt(input_data: dict[str, Any]) -> str:
    writer = json.dumps(input_data.get("writer", {}), ensure_ascii=False)
    layout = json.dumps(input_data.get("layout", {}), ensure_ascii=False)
    round_no = input_data.get("round", 1)

    return f"""你是 AI 公众号质检编辑（第 {round_no} 轮）。对成稿做**多维度打分**（0–100），给出改进意见；评分仅供人工参考，不阻止自动发布。

要求：
1. 只输出 JSON，不要 markdown 代码块
2. 格式：
{{
  "overallScore": 78,
  "dimensions": [
    {{
      "id": "factuality",
      "name": "事实与来源",
      "score": 72,
      "feedback": "该维度具体改进建议"
    }},
    {{
      "id": "compliance",
      "name": "合规表达",
      "score": 85,
      "feedback": "..."
    }},
    {{
      "id": "readability",
      "name": "可读结构",
      "score": 80,
      "feedback": "..."
    }},
    {{
      "id": "wechatFit",
      "name": "微信呈现",
      "score": 75,
      "feedback": "对照 blocks 清单：masthead/hero_svg/lead/section/news_item/sources_footer 是否齐全；hero_svg 是否仅 1 个；来源是否完整"
    }}
  ],
  "feedback": "一段话总结整体质量与优先修改方向",
  "issues": ["跨维度的重要问题，无则 []"],
  "approved": true,
  "target": ""
}}
3. dimensions 必须包含且仅包含上述 4 个 id（factuality / compliance / readability / wechatFit），score 为 0–100 整数
4. overallScore 为四维度加权印象分（0–100），可与 dimensions 均值接近但不必相等
5. 各维度 feedback 写可执行改进意见，50 分以下须写清问题；高分可简短肯定
6. approved：overallScore>=70 且无严重事实/合规硬伤时为 true，否则 false；target 仅在 approved=false 时填 writer 或 layout
7. issues 列出最值得优先处理的 0–5 条
8. wechatFit 专项：若 layout 含 blocks，检查是否含 masthead、lead 或 hero_svg、≥1 section、≥1 news_item、sources_footer；hero_svg 超过 1 个扣分；缺来源链接扣分；若仅有旧版 bodyHtml 则检查移动端可读性与来源声明

Writer：
{writer}

Layout：
{layout}
"""
