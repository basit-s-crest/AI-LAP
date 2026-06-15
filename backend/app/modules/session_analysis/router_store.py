"""
store.py
--------
POST /v1/store-result  — save AI inference result to database
POST /v1/review/action — clinician submits a review
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.session_analysis.schemas import InferenceResultIn, InferenceResultOut, ReviewIn, ReviewOut
from app.modules.session_analysis import crud

router = APIRouter(prefix="/v1", tags=["Store"])


@router.post("/store-result", response_model=InferenceResultOut, status_code=201)
async def store_inference_result(
    payload: InferenceResultIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Called after the AI inference service generates a result.
    Saves inference_events + signals + SHAP + updates member_risk_snapshots.
    """
    try:
        event = await crud.save_inference_result(db, payload)
        return InferenceResultOut(status="saved", event_id=event.event_id, db_id=event.id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/review/action", response_model=ReviewOut, status_code=200)
async def submit_review(
    payload: ReviewIn,
    db: AsyncSession = Depends(get_db),
):
    """
    Called when a clinician submits a review action on a flagged event.
    Marks the event as clinician_reviewed = true.
    """
    try:
        review = await crud.save_review(db, payload)
        return ReviewOut(status="recorded", review_id=review.review_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))



