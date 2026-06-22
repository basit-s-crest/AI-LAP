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
import warnings
from pathlib import Path
from dotenv import load_dotenv

# Suppress Pydantic namespace conflict warnings from third-party libraries (e.g. Presidio)
warnings.filterwarnings("ignore", category=UserWarning, message='.*has conflict with protected namespace "model_".*')

# Load env variables from .env file, overriding any pre-existing environment variables
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

# ── Windows: psycopg (async) requires SelectorEventLoop, not ProactorEventLoop.
# The policy must be set before uvicorn creates its event loop.
# Also pass --loop asyncio on the command line for the reloader subprocess.
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router              import api_router
from app.middleware.request_logger  import RequestLoggerMiddleware

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

import os
if os.getenv("ENVIRONMENT") == "production":
    from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
    app.add_middleware(HTTPSRedirectMiddleware)

# ── Request logger — must be added AFTER CORSMiddleware so it wraps
#    the full request/response cycle (Starlette applies middleware in
#    reverse registration order).
app.add_middleware(RequestLoggerMiddleware)

# ── API routers ───────────────────────────────────────────────────────────────
# Reload trigger comment
app.include_router(api_router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
