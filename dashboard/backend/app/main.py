from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import fleet, agents, memory, recalls, wiki as wiki_router
from .wiki import worker as wiki_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("icarus")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task: asyncio.Task | None = None
    if os.environ.get("ICARUS_WIKI_WORKER") == "1":
        task = asyncio.create_task(wiki_worker.run_forever())
    else:
        logger.info("[wiki] worker disabled (set ICARUS_WIKI_WORKER=1 to enable)")
    try:
        yield
    finally:
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass


def create_app() -> FastAPI:
    app = FastAPI(title="Icarus Dashboard API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(fleet.router)
    app.include_router(agents.router)
    app.include_router(memory.router)
    app.include_router(recalls.router)
    app.include_router(wiki_router.router)

    @app.get("/health")
    def health():
        return {"ok": True}

    return app


app = create_app()
