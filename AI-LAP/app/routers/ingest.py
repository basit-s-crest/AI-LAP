"""
ingest.py
---------
POST /v1/ingest/* — 4 ingestion endpoints (one per source type).

Flow:
  1. Consent gate — 403 if consent_active is false
  2. LLM inference — calls OpenRouter (timed)
  3. Return 202 immediately — includes timing_llm_ms in response body
  4. DB save + cache bust run as a BackgroundTask (fire-and-forget)
     → DB write NEVER delays the response to the caller

Timing fields returned in every IngestOut response:
  timing_llm_ms   — how long the LLM call took (ms)
  timing_total_ms — total time from request receipt to response (ms)

Central timing log:
  Each request writes its stage timings into a Redis Hash:
    vasl:timing:{event_id}  →  { s3_llm_ms, s4_db_ms, fastapi_received_at, ... }
  The test file reads this hash when it receives the final result and writes
  one complete JSON record per request to pipeline_timings.jsonl.
"""

import logging
import time
import os
import json
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.schemas import PeerPostIn, JournalIn, ChatIn, AssessmentIn, IngestOut
from app.core.database import get_db, AsyncSessionLocal
from app.core import crud
from app.core.llm import run_inference
from app.core.cache import bust_member_cache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/ingest", tags=["Ingestion"])

# ── Redis client for timing writes ────────────────────────────────────────────
_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = aioredis.from_url(url, decode_responses=True)
    return _redis_client

TIMING_TTL = 600  # keep timing hashes for 10 minutes


async def _write_timing(event_id: str, fields: dict) -> None:
    """Write timing fields into the shared Redis hash for this event."""
    try:
        r = _get_redis()
        key = f"vasl:timing:{event_id}"
        await r.hset(key, mapping={k: str(v) for k, v in fields.items()})
        await r.expire(key, TIMING_TTL)
    except Exception as e:
        logger.debug("Timing write failed (non-critical): %s", e)


def _consent_check(consent_active: bool, event_id: str) -> None:
    if not consent_active:
        raise HTTPException(
            status_code=403,
            detail={
                "error":   "consent_required",
                "message": f"Member has not provided active consent. Event {event_id} rejected.",
            },
        )


async def _save_in_background(inference, event_id: str, t_llm_done: float) -> None:
    """
    Fire-and-forget DB save + cache bust.
    Writes stage [4] timing into the shared Redis hash.
    """
    t_start = time.perf_counter()
    try:
        async with AsyncSessionLocal() as db:
            await crud.save_inference_result(db, inference)
        await bust_member_cache(inference.member_token)
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        logger.info("[4] LLM→Postgres  event_id=%s  db_save=%dms", event_id, elapsed_ms)
        # Write [4] into the shared timing hash
        await _write_timing(event_id, {
            "s4_db_ms":      elapsed_ms,
            "s4_db_done_at": int(time.time() * 1000),
        })
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        logger.error("[4] LLM→Postgres FAILED  event_id=%s  elapsed=%dms  error=%s",
                     event_id, elapsed_ms, exc)
        await _write_timing(event_id, {"s4_db_error": str(exc)[:200]})


async def _infer_and_store(
    *,
    raw_text:    str,
    source_type: str,
    payload,
    background_tasks: BackgroundTasks,
    original_source_id=None,
    group_id=None,
    mood_score=None,
    session_id=None,
    role=None,
    instrument=None,
    item_number=None,
) -> IngestOut:
    t_request = time.perf_counter()
    t_received_at = int(time.time() * 1000)  # wall-clock ms

    # ── [3] LLM call — timed ──────────────────────────────────────────────────
    t_llm_start = time.perf_counter()
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

    t_llm_done      = time.perf_counter()
    timing_llm_ms   = int((t_llm_done - t_llm_start) * 1000)
    timing_total_ms = int((t_llm_done - t_request)    * 1000)

    logger.info("[3] LLM call done  event_id=%s  tier=%s  llm=%dms",
                payload.event_id, inference.risk_tier, timing_llm_ms)

    # Write stages [3] into the shared timing hash
    await _write_timing(payload.event_id, {
        "s3_llm_ms":          timing_llm_ms,
        "s3_llm_done_at":     int(time.time() * 1000),
        "fastapi_received_at": t_received_at,
        "fastapi_total_ms":   timing_total_ms,
        "risk_tier":          inference.risk_tier,
        "risk_score":         f"{inference.risk_score:.3f}",
    })

    # ── [4] DB save — fire and forget ─────────────────────────────────────────
    background_tasks.add_task(_save_in_background, inference, payload.event_id, t_llm_done)

    return IngestOut(
        status          = "processed",
        event_id        = payload.event_id,
        source          = source_type,
        risk_tier       = inference.risk_tier,
        risk_score      = inference.risk_score,
        timing_llm_ms   = timing_llm_ms,
        timing_total_ms = timing_total_ms,
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/peer-post", response_model=IngestOut, status_code=202)
async def ingest_peer_post(
    payload: PeerPostIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text         = payload.text,
        source_type      = "peer-post",
        payload          = payload,
        background_tasks = background_tasks,
        group_id         = payload.group_id,
    )


@router.post("/journal", response_model=IngestOut, status_code=202)
async def ingest_journal(
    payload: JournalIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text         = payload.text,
        source_type      = "journal",
        payload          = payload,
        background_tasks = background_tasks,
        mood_score       = payload.mood_score,
    )


@router.post("/chat", response_model=IngestOut, status_code=202)
async def ingest_chat(
    payload: ChatIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text         = payload.text,
        source_type      = "chat",
        payload          = payload,
        background_tasks = background_tasks,
        session_id       = payload.session_id,
        role             = payload.role,
    )


@router.post("/assessment", response_model=IngestOut, status_code=202)
async def ingest_assessment(
    payload: AssessmentIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text         = payload.response_text,
        source_type      = "assessment",
        payload          = payload,
        background_tasks = background_tasks,
        instrument       = payload.instrument,
        item_number      = payload.item_number,
    )
