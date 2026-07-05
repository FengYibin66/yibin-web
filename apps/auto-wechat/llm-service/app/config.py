"""Application settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env.development", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = "development"
    port: int = 8090
    dashscope_api_key: str = ""
    # fast：纯文本端点（ChatTongyi）；排序/富化/质检/matcher。勿用 qwen3.7-plus（多模态端点）
    llm_model_fast: str = "qwen-plus"
    llm_model_smart: str = "qwen3.7-max"
    llm_model_layout: str = ""
    llm_max_output_tokens_layout: int = 32768
    # DashScope SDK 默认 read timeout=300s；layout few-shot 长 HTML 需更长
    llm_request_timeout_seconds: int = 600
    image_model: str = "wanx2.1-t2i-turbo"
    image_size: str = "1280*720"
    illustrate_image_size: str = "1024*576"
    cover_image_size: str = "1280*544"
    image_watermark: bool = True


settings = Settings()


def layout_model_name() -> str:
    if settings.llm_model_layout.strip():
        return settings.llm_model_layout.strip()
    return settings.llm_model_smart


def resolve_model_for_agent(agent: str) -> str:
    """ranker/enricher/reviewer/template_matcher → fast; editor/writer → smart; layout → layout."""
    if agent == "layout":
        return layout_model_name()
    if agent in {"editor", "writer"}:
        return settings.llm_model_smart
    return settings.llm_model_fast
