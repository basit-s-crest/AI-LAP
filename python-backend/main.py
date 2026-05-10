"""
main.py
-------
VASL ALAP — FastAPI application entry point.

Start the server (Windows):
    uvicorn main:app --reload --loop asyncio --port 8000

Start the server (Linux/Mac):
    uvicorn main:app --reload --port 8000

API docs:
    http://localhost:8000/docs
"""

import sys

# ── Windows: psycopg (async) requires SelectorEventLoop, not ProactorEventLoop.
# The policy must be set before uvicorn creates its event loop.
# Also pass --loop asyncio on the command line for the reloader subprocess.
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ingest, store, dashboard, request_logs, pipeline
from app.middleware.request_logger import RequestLoggerMiddleware

app = FastAPI(
    title="VASL ALAP API",
    version="1.0.0",
    description="Ingestion gateway, inference storage, and dashboard APIs for VASL ALAP",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logger — must be added AFTER CORSMiddleware so it wraps
#    the full request/response cycle (Starlette applies middleware in
#    reverse registration order).
app.add_middleware(RequestLoggerMiddleware)

# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(ingest.router)
app.include_router(store.router)
app.include_router(dashboard.router)
app.include_router(request_logs.router)
app.include_router(pipeline.router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
