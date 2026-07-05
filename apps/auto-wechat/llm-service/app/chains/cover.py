"""Cover image generation via DashScope Wanx (WeChat thumb 2.35:1)."""

from __future__ import annotations

from typing import Any

from app.config import settings


def run_cover(input_data: dict[str, Any]) -> dict[str, Any]:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    title = str(input_data.get("title") or "").strip()
    summary = str(input_data.get("summary") or "").strip()
    topic = str(input_data.get("topic") or "").strip()

    if not title and not topic:
        raise RuntimeError("cover generation requires title or topic")

    prompt = _build_image_prompt(title, summary, topic)
    url = _synthesize_image(prompt)

    return {
        "coverImageUrl": url,
        "imagePrompt": prompt,
        "source": "generated",
    }


def _build_image_prompt(title: str, summary: str, topic: str) -> str:
    daily_theme = topic or title
    headline = title or topic
    context = summary or topic or title
    return (
        "微信公众号科技资讯头条封面，超宽横屏 2.35:1 构图，"
        "写实摄影与高端科技视觉，画面极具吸引力与冲击力，"
        f"今日主题：{daily_theme}。"
        f"标题线索：{headline}。"
        f"今日要闻氛围与视觉意象：{context[:300]}。"
        "深色科技感场景，蓝紫霓虹光晕、粒子光流、数据中心机架、芯片晶圆、"
        "神经网络节点或未来都市天际线等科技意象，电影级布光与景深，"
        "高对比、细节锐利，适合移动端订阅号头条缩略图，"
        "一眼可感知是 AI 科技日报、贴合当日资讯主题，"
        "画面中不要出现任何文字、标题、日期或 Logo。"
    )


def _synthesize_image(prompt: str) -> str:
    import dashscope
    from dashscope import ImageSynthesis

    dashscope.api_key = settings.dashscope_api_key

    response = ImageSynthesis.call(
        model=settings.image_model,
        prompt=prompt,
        n=1,
        size=settings.cover_image_size,
        watermark=settings.image_watermark,
    )

    status = getattr(response, "status_code", None)
    if status is not None and status != 200:
        message = getattr(response, "message", None) or str(response)
        raise RuntimeError(f"image synthesis failed: {message}")

    output = getattr(response, "output", None) or {}
    if isinstance(output, dict):
        results = output.get("results") or []
        if results and isinstance(results[0], dict) and results[0].get("url"):
            return str(results[0]["url"])

    raise RuntimeError("image synthesis returned no url")
