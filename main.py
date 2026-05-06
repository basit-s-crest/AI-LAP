from fastapi import FastAPI
from routers import store, ingest, dashboard
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="VASL ALAP API",
    version="1.0.0",
    description="Ingestion gateway, inference storage, and dashboard APIs for VASL ALAP"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(store.router)
app.include_router(ingest.router)
app.include_router(dashboard.router)

@app.get("/health")
async def health():
    return {"status": "ok"}