"""Shared ChatTongyi factory with DashScope request_timeout."""

from __future__ import annotations

from app.config import settings


def create_chat_tongyi(
    *,
    model: str,
    temperature: float,
    max_tokens: int | None = None,
    streaming: bool = False,
):
    from langchain_community.chat_models.tongyi import ChatTongyi

    model_kwargs = {"request_timeout": settings.llm_request_timeout_seconds}
    kwargs: dict = {
        "model": model,
        "dashscope_api_key": settings.dashscope_api_key,
        "temperature": temperature,
        "model_kwargs": model_kwargs,
        "streaming": streaming,
    }
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    return ChatTongyi(**kwargs)
