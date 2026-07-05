"""FastAPI routes."""

from fastapi import APIRouter, HTTPException

from app.chains.cover import run_cover
from app.chains.illustrate import run_illustrate
from app.chains.editor import run_editor
from app.chains.enricher import run_enricher
from app.chains.layout import run_layout
from app.chains.template_matcher import run_template_matcher
from app.chains.ranker import run_ranker
from app.chains.reviewer import run_reviewer
from app.chains.writer import run_writer
from app.config import resolve_model_for_agent, settings
from app.schemas import LLMInvokeRequest, LLMInvokeResponse, LLMUsage

router = APIRouter()

AGENT_RUNNERS = {
    "ranker": run_ranker,
    "enricher": run_enricher,
    "editor": run_editor,
    "writer": run_writer,
    "layout": run_layout,
    "template_matcher": run_template_matcher,
    "reviewer": run_reviewer,
    "cover": run_cover,
    "illustrate": run_illustrate,
}

SMART_AGENTS = {"editor", "writer", "layout"}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/v1/agents")
def list_agents() -> dict[str, list[str]]:
    return {"agents": list(AGENT_RUNNERS.keys())}


@router.post("/v1/llm/invoke", response_model=LLMInvokeResponse)
def invoke_llm(payload: LLMInvokeRequest) -> LLMInvokeResponse:
    runner = AGENT_RUNNERS.get(payload.agent)
    if runner is None:
        raise HTTPException(status_code=400, detail=f"unknown agent: {payload.agent}")

    model = payload.model or resolve_model_for_agent(payload.agent)
    try:
        output = runner(payload.input)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return LLMInvokeResponse(
        agent=payload.agent,
        output=output,
        usage=LLMUsage(),
        model=model,
    )
