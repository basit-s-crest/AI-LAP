from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas import InferenceResultIn, InferenceResultOut, ReviewIn, ReviewOut
import crud

router = APIRouter(prefix="/v1", tags=["store"])


@router.post("/store-result", response_model=InferenceResultOut, status_code=201)
async def store_inference_result(
    payload: InferenceResultIn,
    db: AsyncSession = Depends(get_db)
):
    """
    Called after the LLM generates a response.
    Saves inference_events + signals + shap + updates member_risk_snapshots.
    """
    try:
        event = await crud.save_inference_result(db, payload)
        return InferenceResultOut(
            status="saved",
            event_id=event.event_id,
            db_id=event.id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/review/action", response_model=ReviewOut, status_code=200)
async def submit_review(
    payload: ReviewIn,
    db: AsyncSession = Depends(get_db)
):
    """
    Called when a clinician submits a review action.
    Records the review and marks the event as clinician_reviewed = true.
    """
    try:
        review = await crud.save_review(db, payload)
        return ReviewOut(status="recorded", review_id=review.review_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
