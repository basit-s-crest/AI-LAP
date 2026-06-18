import logging
from fastapi import APIRouter, HTTPException
from app.modules.live_video_analysis.schemas import SessionAggregation
from app.modules.live_video_analysis.service import get_session_wide_aggregation

logger = logging.getLogger(__name__)

# Router with no fixed prefix to allow registering both v1 and non-v1 routes
router = APIRouter(tags=["Live Video Analysis"])

@router.get("/v1/live-video-analysis/{session_id}/aggregation", response_model=SessionAggregation)
async def get_session_aggregation_endpoint(session_id: str):
    """
    Get the in-memory emotion aggregation for the given session.
    """
    try:
        agg = get_session_wide_aggregation(session_id)
        return agg
    except Exception as e:
        logger.error(f"Error fetching session aggregation for {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
