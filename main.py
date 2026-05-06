"""
main.py
-------
VASL ALAP — FastAPI application entry point.

Start the server:
    uvicorn main:app --reload

API docs:
    http://localhost:8000/docs
Dashboard:
    http://localhost:8000/
"""

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

# ── API routers (must be registered BEFORE the static mount) ──────────────────
app.include_router(ingest.router)
app.include_router(store.router)
app.include_router(dashboard.router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# ── Serve frontend dashboard at / ─────────────────────────────────────────────
# Serves therapist.html directly — avoids the index.html naming requirement
@app.get("/", include_in_schema=False)
async def serve_dashboard():
    return FileResponse("frontend/therapist.html")
