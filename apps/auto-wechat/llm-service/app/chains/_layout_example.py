"""Golden blocks example for layout planner few-shot."""

BLOCKS_EXAMPLE = {
    "title": "OpenAI 新模型领衔，Agent 框架密集更新",
    "coverImageUrl": "",
    "layoutNotes": "按 editor.outline 分板块；hero 展开导读；来源与 writer 一致",
    "blocks": [
        {
            "type": "masthead",
            "seriesTitle": "AI 科技日报",
            "dateLabel": "2026年6月4日",
            "topic": "今日 AI 要闻速览",
        },
        {
            "type": "hero_svg",
            "variant": "lead_expand",
            "leadText": "今日大模型与应用层均有重要更新，Agent 工具链继续演进。",
            "tapHint": "点击展开今日导读",
            "backgroundImageUrl": "",
        },
        {
            "type": "lead",
            "text": "今日大模型与应用层均有重要更新，Agent 工具链继续演进。",
        },
        {
            "type": "section",
            "heading": "大模型",
            "tag": "大模型",
        },
        {
            "type": "news_item",
            "headline": "新模型发布",
            "summary": "上下文窗口扩大，推理成本下降。",
            "sourceName": "HN",
            "sourceUrl": "https://news.ycombinator.com/item?id=123",
        },
        {"type": "divider"},
        {
            "type": "section",
            "heading": "Agent",
            "tag": "Agent",
        },
        {
            "type": "news_item",
            "summary": "开源 Agent 编排框架发布新版本。",
            "sourceName": "GitHub",
            "sourceUrl": "https://github.com/example/repo",
        },
        {
            "type": "sources_footer",
            "title": "参考来源",
            "sources": [
                {"name": "HN", "url": "https://news.ycombinator.com/item?id=123"},
                {"name": "GitHub", "url": "https://github.com/example/repo"},
            ],
        },
    ],
}
