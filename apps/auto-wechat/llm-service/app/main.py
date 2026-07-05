"""FastAPI application entry."""

from fastapi import FastAPI

from app.config import settings
from app.routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="llm-service",
        version="0.1.0",
        description="Thin LangChain LLM sidecar for auto_wechat_tech_content",
    )
    app.include_router(router)
    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.env == "development",
    )


if __name__ == "__main__":
    main()
