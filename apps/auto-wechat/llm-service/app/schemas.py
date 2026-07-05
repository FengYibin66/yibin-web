"""Pydantic schemas for LLM invoke API."""

from typing import Any

from pydantic import BaseModel, Field


class LLMInvokeRequest(BaseModel):
    agent: str = Field(..., description="Agent name: ranker|writer|layout|...")
    input: dict[str, Any] = Field(default_factory=dict)
    model: str | None = None


class LLMUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class LLMInvokeResponse(BaseModel):
    agent: str
    output: dict[str, Any]
    usage: LLMUsage = Field(default_factory=LLMUsage)
    model: str
