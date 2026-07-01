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
from datetime import datetime, timezone
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.session_analysis.schemas import PeerPostIn, JournalIn, ChatIn, AssessmentIn, ChangeInsightIn, IngestOut
from app.core.database import get_db, AsyncSessionLocal
from app.modules.session_analysis import crud
from app.modules.session_analysis.llm import run_inference
from app.modules.session_analysis.cache import bust_member_cache
from app.shared.pipeline_logger import log_stage

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


async def _save_in_background(inference, event_id: str, t_llm_done: float,
                              member_token: str, org_id: str, source_type: str,
                              raw_text: str, session_id=None, role=None) -> None:
    """
    Fire-and-forget DB save + cache bust.
    Writes stage [4] timing into the shared Redis hash AND pipeline_stage_logs.
    """
    stage_started = datetime.now(timezone.utc)
    t_start = time.perf_counter()
    try:
        async with AsyncSessionLocal() as db:
            await crud.save_inference_result(db, inference)
        await bust_member_cache(inference.member_token)
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        stage_finished = datetime.now(timezone.utc)

        logger.info("[4] LLM→Postgres  event_id=%s  db_save=%dms", event_id, elapsed_ms)

        # Write [4] into the shared Redis timing hash
        await _write_timing(event_id, {
            "s4_db_ms":      elapsed_ms,
            "s4_db_done_at": int(time.time() * 1000),
        })

        # ── Stage 4: db_save ─────────────────────────────────────────────────
        await log_stage(
            event_id     = event_id,
            member_token = member_token,
            org_id       = org_id,
            session_id   = session_id,
            role         = role,
            source_type  = source_type,
            stage_num    = 4,
            stage_name   = "db_save",
            started_at   = stage_started,
            finished_at  = stage_finished,
            duration_ms  = elapsed_ms,
            status       = "ok",
        )

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - t_start) * 1000)
        logger.error("[4] LLM→Postgres FAILED  event_id=%s  elapsed=%dms  error=%s",
                     event_id, elapsed_ms, exc)
        await _write_timing(event_id, {"s4_db_error": str(exc)[:200]})

        await log_stage(
            event_id      = event_id,
            member_token  = member_token,
            org_id        = org_id,
            session_id    = session_id,
            role          = role,
            source_type   = source_type,
            stage_num     = 4,
            stage_name    = "db_save",
            started_at    = stage_started,
            finished_at   = datetime.now(timezone.utc),
            duration_ms   = elapsed_ms,
            status        = "error",
            error_message = str(exc)[:500],
        )


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
    t_request     = time.perf_counter()
    t_received_at = int(time.time() * 1000)   # wall-clock epoch ms
    stage1_start  = datetime.now(timezone.utc)

    # ── Stage 1: fastapi_received ─────────────────────────────────────────────
    await log_stage(
        event_id     = payload.event_id,
        member_token = payload.member_token,
        org_id       = payload.org_id,
        session_id   = session_id,
        role         = role,
        source_type  = source_type,
        stage_num    = 1,
        stage_name   = "fastapi_received",
        started_at   = stage1_start,
        finished_at  = stage1_start,
        duration_ms  = 0,
        status       = "ok",
    )

    # ── Stage 2: consent_check ────────────────────────────────────────────────
    # (consent was already validated by the caller before _infer_and_store,
    #  so we always log "ok" here — the 403 path logs "error" in the endpoint)
    stage2_start = datetime.now(timezone.utc)
    await log_stage(
        event_id     = payload.event_id,
        member_token = payload.member_token,
        org_id       = payload.org_id,
        session_id   = session_id,
        role         = role,
        source_type  = source_type,
        stage_num    = 2,
        stage_name   = "consent_check",
        started_at   = stage2_start,
        finished_at  = datetime.now(timezone.utc),
        duration_ms  = 0,
        status       = "ok",
    )

    # ── Stage 3: llm_call ─────────────────────────────────────────────────────
    stage3_start = datetime.now(timezone.utc)
    t_llm_start  = time.perf_counter()
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
        llm_elapsed = int((time.perf_counter() - t_llm_start) * 1000)
        await log_stage(
            event_id      = payload.event_id,
            member_token  = payload.member_token,
            org_id        = payload.org_id,
            session_id    = session_id,
            role          = role,
            source_type   = source_type,
            stage_num     = 3,
            stage_name    = "llm_call",
            started_at    = stage3_start,
            finished_at   = datetime.now(timezone.utc),
            duration_ms   = llm_elapsed,
            status        = "error",
            error_message = str(exc)[:500],
        )
        logger.error("LLM inference failed for event %s: %s", payload.event_id, exc)
        raise HTTPException(status_code=502, detail=f"LLM inference failed: {exc}")

    t_llm_done      = time.perf_counter()
    timing_llm_ms   = int((t_llm_done - t_llm_start) * 1000)
    timing_total_ms = int((t_llm_done - t_request)    * 1000)
    stage3_end      = datetime.now(timezone.utc)

    logger.info("[3] LLM call done  event_id=%s  tier=%s  llm=%dms",
                payload.event_id, inference.risk_tier, timing_llm_ms)

    await log_stage(
        event_id     = payload.event_id,
        member_token = payload.member_token,
        org_id       = payload.org_id,
        session_id   = session_id,
        role         = role,
        source_type  = source_type,
        stage_num    = 3,
        stage_name   = "llm_call",
        started_at   = stage3_start,
        finished_at  = stage3_end,
        duration_ms  = timing_llm_ms,
        status       = "ok",
        risk_tier    = inference.risk_tier,
        risk_score   = float(inference.risk_score),
        risk_trend   = inference.risk_trend,
    )

    # Write stages [3] into the shared Redis timing hash
    await _write_timing(payload.event_id, {
        "s3_llm_ms":           timing_llm_ms,
        "s3_llm_done_at":      int(time.time() * 1000),
        "fastapi_received_at": t_received_at,
        "fastapi_total_ms":    timing_total_ms,
        "risk_tier":           inference.risk_tier,
        "risk_score":          f"{inference.risk_score:.3f}",
    })

    # ── Stage 4: db_save — fire and forget ────────────────────────────────────
    background_tasks.add_task(
        _save_in_background,
        inference, payload.event_id, t_llm_done,
        payload.member_token, payload.org_id, source_type, raw_text,
        session_id, role,
    )

    # ── Stage 5: response_sent ────────────────────────────────────────────────
    stage5_now = datetime.now(timezone.utc)
    await log_stage(
        event_id     = payload.event_id,
        member_token = payload.member_token,
        org_id       = payload.org_id,
        session_id   = session_id,
        role         = role,
        source_type  = source_type,
        stage_num    = 5,
        stage_name   = "response_sent",
        started_at   = stage5_now,
        finished_at  = stage5_now,
        duration_ms  = timing_total_ms,
        status       = "ok",
        risk_tier    = inference.risk_tier,
        risk_score   = float(inference.risk_score),
    )

    return IngestOut(
        status          = "processed",
        event_id        = payload.event_id,
        source          = source_type,
        risk_tier       = inference.risk_tier,
        risk_score      = inference.risk_score,
        risk_trend      = inference.risk_trend,
        recommended_action = inference.recommended_action,
        active_signals  = inference.active_signals,
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
        original_source_id = payload.original_source_id,
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


@router.post("/change-insight", response_model=IngestOut, status_code=202)
async def ingest_change_insight(
    payload: ChangeInsightIn,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    _consent_check(payload.consent_active, payload.event_id)
    return await _infer_and_store(
        raw_text         = payload.text,
        source_type      = "change-insight",
        payload          = payload,
        background_tasks = background_tasks,
        original_source_id = payload.original_source_id,
    )






