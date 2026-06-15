"""
api/v1/router.py
----------------
Central route registry for API v1.
To add a new module: import its router and call include_router here.
main.py never imports individual module routers directly.
"""

from fastapi import APIRouter

from app.modules.session_analysis.router_ingest        import router as ingest_router
from app.modules.session_analysis.router_store         import router as store_router
from app.modules.session_analysis.router_dashboard     import router as dashboard_router
from app.modules.session_analysis.router_pipeline      import router as pipeline_router
from app.modules.session_analysis.router_request_logs  import router as request_logs_router
from app.modules.risk_engine.router                    import router as risk_router
from app.modules.stt.router                            import router as stt_router

api_router = APIRouter()

api_router.include_router(ingest_router)
api_router.include_router(store_router)
api_router.include_router(dashboard_router)
api_router.include_router(pipeline_router)
api_router.include_router(request_logs_router)
api_router.include_router(risk_router)
api_router.include_router(stt_router)
