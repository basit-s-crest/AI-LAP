"""
ingest.py
---------
POST /v1/ingest/* — 4 ingestion endpoints (one per source type).

Flow:
  1. Consent gate — 403 if consent_active is false
  2. LLM inference — calls OpenAI with the raw text
  3. Save to DB    — stores inference_events + signals + SHAP + updates snapshot
  4. Cache bust    — invalidates Redis cache for this member
  5. Return 202    — event_id + risk_tier from LLM

The Kafka stub is kept as a comment for when you wire up the real pipeline.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schemas import PeerPostIn, JournalIn, ChatIn, AssessmentIn, IngestOut
from app.core.database import get_db
from app.core import crud
from app.core.llm import run_inference
from app.core.cache import bust_member_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/ingest", tags=["Ingestion"])


def _consent_check(consent_active: bool, event_id: str) -> None:
    if not consent_active:
        raise HTTPException(
            status_code=403,
            detail={
                "error":   "consent_required",
                "message": f"Member has not provided active consent. Event {event_id} rejected.",
            },
        )


async def _infer_and_store(
    *,
    raw_text:    str,
    source_type: str,
    payload,                  # the validated Pydantic model
    db: AsyncSession,
    # optional source-specific fields
    original_source_id=None,
    group_id=None,
    mood_score=None,
    session_id=None,
    role=None,
    instrument=None,
    item_number=None,
) -> IngestOut:
    """Shared helper: LLM → save → cache bust → return IngestOut."""
    try:
        inference = await run_inference(
            raw_text            = raw_text,
            event_id            = payload.event_id,
            member_token        = payload.member_token,
            org_id              = payload.org_id,
            source_type         = source_type,
            event_timestamp     = payload.timestamp,
            original_source_id  = original_source_id,
            group_id            = group_id,
            mood_score          = mood_score,
            session_id          = session_id,
            role                = role,
            instrument          = instrument,
            item_number         = item_number,
        )
    except Exception as exc:
        logger.error("LLM inference failed for event %s: %s", payload.event_id, exc)
        raise HTTPException(status_code=502, detail=f"LLM inference failed: {exc}")

    try:
        await crud.save_inference_result(db, inference)
    except Exception as exc:
        logger.error("DB save failed for event %s: %s", payload.event_id, exc)
        raise HTTPException(status_code=500, detail=f"DB save failed: {exc}")

    # Invalidate Redis cache so dashboard shows fresh data
    await bust_member_cache(payload.member_token)

    return IngestOut(
        status   = "processed",
        event_id = payload.event_id,
        source   = source_type,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/peer-post", response_model=IngestOut, status_code=202)
async def ingest_peer_post(
    payload: PeerPostIn,
    db: AsyncSession = Depends(get_db),
):
    """Accept a peer group post → LLM inference → store → 202."""
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text    = payload.text,
        source_type = "peer-post",
        payload     = payload,
        db          = db,
        group_id    = payload.group_id,
    )


@router.post("/journal", response_model=IngestOut, status_code=202)
async def ingest_journal(
    payload: JournalIn,
    db: AsyncSession = Depends(get_db),
):
    """Accept a mood journal entry → LLM inference → store → 202."""
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text    = payload.text,
        source_type = "journal",
        payload     = payload,
        db          = db,
        mood_score  = payload.mood_score,
    )


@router.post("/chat", response_model=IngestOut, status_code=202)
async def ingest_chat(
    payload: ChatIn,
    db: AsyncSession = Depends(get_db),
):
    """Accept a coach chat message → LLM inference → store → 202."""
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text    = payload.text,
        source_type = "chat",
        payload     = payload,
        db          = db,
        session_id  = payload.session_id,
        role        = payload.role,
    )


@router.post("/assessment", response_model=IngestOut, status_code=202)
async def ingest_assessment(
    payload: AssessmentIn,
    db: AsyncSession = Depends(get_db),
):
    """Accept a clinical assessment response → LLM inference → store → 202."""
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text    = payload.response_text,
        source_type = "assessment",
        payload     = payload,
        db          = db,
        instrument  = payload.instrument,
        item_number = payload.item_number,
    )
