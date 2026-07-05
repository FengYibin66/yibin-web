"""News thumbnail illustration via DashScope Wanx (16:9)."""

from __future__ import annotations

from typing import Any

from app.config import settings


def run_illustrate(input_data: dict[str, Any]) -> dict[str, Any]:
    if not settings.dashscope_api_key:
        raise RuntimeError("DASHSCOPE_API_KEY not configured")

    headline = str(input_data.get("headline") or "").strip()
    summary = str(input_data.get("summary") or "").strip()
    topic = str(input_data.get("topic") or "").strip()
    section = str(input_data.get("section") or "").strip()

    if not headline:
        raise RuntimeError("illustrate generation requires headline")

    prompt = _build_image_prompt(headline, summary, topic, section)
    url = _synthesize_image(prompt)

    return {
        "imageUrl": url,
        "imagePrompt": prompt,
        "source": "generated",
    }


def _build_image_prompt(
    headline: str, summary: str, topic: str, section: str = ""
) -> str:
    context = summary or topic or headline
    section_line = f"所属板块：{section}。" if section else ""
    return (
        "科技新闻配图，横版 16:9 构图，写实摄影风格，高清照片质感，"
        f"新闻主题：{headline}。"
        f"{section_line}"
        f"画面内容与氛围：{context[:300]}。"
        "自然光影、细节丰富、构图专业，适合微信公众号正文配图，"
        "画面中不要出现文字、标题或品牌 Logo。"
    )


def _synthesize_image(prompt: str) -> str:
    import dashscope
    from dashscope import ImageSynthesis

    dashscope.api_key = settings.dashscope_api_key

    response = ImageSynthesis.call(
        model=settings.image_model,
        prompt=prompt,
        n=1,
        size=settings.illustrate_image_size,
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
