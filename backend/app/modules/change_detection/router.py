from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from app.modules.change_detection.services import run_session_comparison

class SessionNoteDetails(BaseModel):
    summary: str
    keyThemes: List[str]
    sentiment: str
    coachObservations: str
    recommendedFollowUp: str

class CompareRequest(BaseModel):
    noteA: SessionNoteDetails
    noteB: SessionNoteDetails

class CompareResponse(BaseModel):
    summary: str
    improvements: List[Dict]
    concerns: List[Dict]
    goals: List[Dict]
    behavioralPatterns: List[str]
    safetyFlags: List[Dict]
    hasSafetyAlert: bool

router = APIRouter(prefix="/v1/change-detection", tags=["AI Change Detection"])

@router.post(
    "/compare",
    response_model=CompareResponse,
    summary="Compare two session notes to extract longitudinal change insights",
)
async def compare_notes(request: CompareRequest):
    """
    Triggers an LLM comparison analysis between two session notes.
    Evaluates improvements, concerns, goals, behavioral patterns, and safety flags.
    """
    try:
        result = await run_session_comparison(
            request.noteA.dict(),
            request.noteB.dict()
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")
