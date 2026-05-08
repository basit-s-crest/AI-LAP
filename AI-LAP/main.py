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
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers import ingest, store, dashboard

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

# ── API routers ───────────────────────────────────────────────────────────────
app.include_router(ingest.router)
app.include_router(store.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# ── Serve frontend dashboard at / ─────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def serve_dashboard():
    return FileResponse("frontend/therapist.html")
