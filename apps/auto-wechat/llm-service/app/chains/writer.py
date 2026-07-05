"""Writer chain — article body in Markdown."""

from __future__ import annotations

import json
from typing import Any

from app.chains._digest_tags import TAG_TAXONOMY_HINT
from app.chains._json_utils import parse_json_object
from app.config import settings


def run_writer(input_data: dict[str, Any]) -> dict[str, Any]:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    from langchain_community.chat_models.tongyi import ChatTongyi
    from langchain_core.messages import HumanMessage

    prompt = _build_prompt(input_data)
    llm = ChatTongyi(
        model=settings.llm_model_smart,
        dashscope_api_key=settings.dashscope_api_key,
        temperature=0.7,
    )
    response = llm.invoke([HumanMessage(content=prompt)])
    content = response.content if isinstance(response.content, str) else str(response.content)
    return parse_json_object(content)


def _build_prompt(input_data: dict[str, Any]) -> str:
    editor = json.dumps(input_data.get("editor", {}), ensure_ascii=False)
    items = json.dumps(input_data.get("items", []), ensure_ascii=False)
    feedback = input_data.get("feedback", "")
    feedback_block = f"\n\n修改意见（必须落实）：\n{feedback}" if feedback else ""

    return f"""你是 AI 科技公众号撰稿人。根据选题大纲与素材，撰写一篇中文 AI 日报。

要求：
1. 只输出 JSON，不要 markdown 代码块
2. 格式：
{{
  "title": "主标题（≤20字）",
  "titleCandidates": ["候选1", "候选2", "候选3"],
  "summary": "100字内导语",
  "bodyMarkdown": "正文 Markdown，含 ## 小标题、列表、来源链接",
  "sources": [{{"name": "来源名", "url": "https://..."}}]
}}
3. 正文结构必须与 editor.outline 的板块一致：
   - 每个 outline.heading（除「导语」外）对应 bodyMarkdown 中的一个 ## 二级标题
   - 若 outline 条目含 tag 字段，## 标题优先使用该 tag/heading 名称
   - 每个板块下列出对应资讯，使用 summaryZh，并附 [来源](url) 链接
4. 语气专业清晰，面向开发者与 AI 从业者
5. 每条资讯必须标注来源链接
6. 字数 800-1200 字
7. 素材 tags 参考体系：{TAG_TAXONOMY_HINT}

选题大纲：
{editor}

素材 Top10（含 tags、summaryZh）：
{items}{feedback_block}
"""
