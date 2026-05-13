"""
pipeline.py
-----------
POST /v1/pipeline/flush/{event_id}
    Reads the completed Redis timing hash for an event and upserts
    one row into pipeline_runs with all 6 stages' start/end/duration.

    Called by:
      - worker.mjs  after stage [5] publish completes
      - test_pipeline.mjs  after stage [6] e2e time is recorded

GET /v1/pipeline/runs
    Paginated list of pipeline_runs rows, newest first.

GET /v1/pipeline/runs/{event_id}
    Full detail for a single run.

GET /v1/pipeline/stats
    Aggregate timing stats across all runs.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional, List

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/pipeline", tags=["Pipeline Runs"])

# ── Redis ─────────────────────────────────────────────────────────────────────
_redis: Optional[aioredis.Redis] = None

def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis = aioredis.from_url(url, decode_responses=True)
    return _redis


# ── Helpers ───────────────────────────────────────────────────────────────────

def _int(v) -> Optional[int]:
    """Safe int parse — returns None for missing/empty values."""
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def _epoch_to_dt(epoch_ms: Optional[int]) -> Optional[datetime]:
    """Convert Unix epoch milliseconds → timezone-aware datetime."""
    if epoch_ms is None:
        return None
    return datetime.fromtimestamp(epoch_ms / 1000.0, tz=timezone.utc)


# ── Flush endpoint ────────────────────────────────────────────────────────────

class FlushOut(BaseModel):
    status:   str
    event_id: str
    stages_written: List[str]


@router.post("/flush/{event_id}", response_model=FlushOut)
async def flush_pipeline_run(
    event_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Read the Redis timing hash for event_id and upsert into pipeline_runs.

    Redis hash fields (written by test_pipeline, worker, FastAPI):
      s1_enqueue_ms        s1_queue_wait_ms     worker_pickup_at
      s2_fastapi_ms        s2_fastapi_done_at
      s3_llm_ms            fastapi_received_at  s3_llm_done_at  fastapi_total_ms
      s4_db_ms             s4_db_done_at
      s5_publish_ms        s5_published_at
      s6_e2e_ms            result_received_at   enqueue_time
      risk_tier            risk_score
      text                 job_num
    """
    r = _get_redis()
    key = f"vasl:timing:{event_id}"

    try:
        h = await r.hgetall(key)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Redis unavailable: {exc}")

    if not h:
        raise HTTPException(status_code=404, detail=f"No timing data found for event_id '{event_id}'")

    # ── Parse all raw values ──────────────────────────────────────────────────
    enqueue_time_ms      = _int(h.get("enqueue_time"))
    worker_pickup_ms     = _int(h.get("worker_pickup_at"))
    fastapi_received_ms  = _int(h.get("fastapi_received_at"))
    s3_llm_done_ms       = _int(h.get("s3_llm_done_at"))
    s4_db_done_ms        = _int(h.get("s4_db_done_at"))
    s5_published_ms      = _int(h.get("s5_published_at"))
    s2_fastapi_done_ms   = _int(h.get("s2_fastapi_done_at"))
    result_received_ms   = _int(h.get("result_received_at"))

    s1_enqueue_ms        = _int(h.get("s1_enqueue_ms"))
    s1_queue_wait_ms     = _int(h.get("s1_queue_wait_ms"))
    s2_ms                = _int(h.get("s2_fastapi_ms"))
    s3_ms                = _int(h.get("s3_llm_ms"))
    s4_ms                = _int(h.get("s4_db_ms"))
    s5_ms                = _int(h.get("s5_publish_ms"))
    s6_ms                = _int(h.get("s6_e2e_ms"))
    fastapi_total_ms     = _int(h.get("fastapi_total_ms"))

    risk_score_raw = h.get("risk_score")
    risk_score = float(risk_score_raw) if risk_score_raw else None

    # ── Derive start/end timestamps for each stage ────────────────────────────
    #
    # Stage [1a] frontend → BullMQ enqueue
    #   start = enqueue_time
    #   end   = enqueue_time + s1_enqueue_ms
    s1e_start = _epoch_to_dt(enqueue_time_ms)
    s1e_end   = _epoch_to_dt(enqueue_time_ms + s1_enqueue_ms
                              if enqueue_time_ms and s1_enqueue_ms else None)

    # Stage [1b] BullMQ queue wait
    #   start = enqueue_time  (job was sitting in queue from this point)
    #   end   = worker_pickup_at
    s1q_start = _epoch_to_dt(enqueue_time_ms)
    s1q_end   = _epoch_to_dt(worker_pickup_ms)

    # Stage [2] worker → FastAPI HTTP
    #   start = worker_pickup_at  (worker starts the fetch)
    #   end   = s2_fastapi_done_at
    s2_start = _epoch_to_dt(worker_pickup_ms)
    s2_end   = _epoch_to_dt(s2_fastapi_done_ms)

    # Stage [3] FastAPI LLM call
    #   start = fastapi_received_at
    #   end   = s3_llm_done_at  (or start + s3_llm_ms if done_at missing)
    s3_start = _epoch_to_dt(fastapi_received_ms)
    s3_end   = _epoch_to_dt(s3_llm_done_ms) or (
        _epoch_to_dt(fastapi_received_ms + s3_ms)
        if fastapi_received_ms and s3_ms else None
    )

    # Stage [4] FastAPI background DB save
    #   start = s3_llm_done_at  (DB save starts right after LLM finishes)
    #   end   = s4_db_done_at   (or start + s4_db_ms)
    s4_start = _epoch_to_dt(s3_llm_done_ms)
    s4_end   = _epoch_to_dt(s4_db_done_ms) or (
        _epoch_to_dt(s3_llm_done_ms + s4_ms)
        if s3_llm_done_ms and s4_ms else None
    )

    # Stage [5] worker Redis publish
    #   start = s2_fastapi_done_at  (publish starts right after FastAPI responds)
    #   end   = s5_published_at
    s5_start = _epoch_to_dt(s2_fastapi_done_ms)
    s5_end   = _epoch_to_dt(s5_published_ms)

    # Stage [6] full end-to-end
    #   start = enqueue_time
    #   end   = result_received_at
    s6_start = _epoch_to_dt(enqueue_time_ms)
    s6_end   = _epoch_to_dt(result_received_ms)

    # ── Track which stages have data ──────────────────────────────────────────
    stages_written = []
    if s1_enqueue_ms is not None:  stages_written.append("s1_enqueue")
    if s1_queue_wait_ms is not None: stages_written.append("s1_queue_wait")
    if s2_ms is not None:          stages_written.append("s2_bullmq_to_fastapi")
    if s3_ms is not None:          stages_written.append("s3_llm_call")
    if s4_ms is not None:          stages_written.append("s4_db_save")
    if s5_ms is not None:          stages_written.append("s5_publish")
    if s6_ms is not None:          stages_written.append("s6_e2e")

    is_complete = s6_ms is not None

    # ── Upsert into pipeline_runs ─────────────────────────────────────────────
    await db.execute(text("""
        INSERT INTO pipeline_runs (
            event_id, job_num, text,
            s1_enqueue_started_at,  s1_enqueue_finished_at,  s1_enqueue_ms,
            s1_queue_wait_started_at, s1_queue_wait_finished_at, s1_queue_wait_ms,
            s2_started_at,  s2_finished_at,  s2_ms,
            s3_started_at,  s3_finished_at,  s3_ms,
            s4_started_at,  s4_finished_at,  s4_ms,
            s5_started_at,  s5_finished_at,  s5_ms,
            s6_started_at,  s6_finished_at,  s6_ms,
            risk_tier, risk_score,
            fastapi_total_ms, is_complete, updated_at
        ) VALUES (
            :event_id, :job_num, :text,
            :s1e_start, :s1e_end, :s1_enqueue_ms,
            :s1q_start, :s1q_end, :s1_queue_wait_ms,
            :s2_start,  :s2_end,  :s2_ms,
            :s3_start,  :s3_end,  :s3_ms,
            :s4_start,  :s4_end,  :s4_ms,
            :s5_start,  :s5_end,  :s5_ms,
            :s6_start,  :s6_end,  :s6_ms,
            :risk_tier, :risk_score,
            :fastapi_total_ms, :is_complete, NOW()
        )
        ON CONFLICT (event_id) DO UPDATE SET
            job_num                  = COALESCE(EXCLUDED.job_num,  pipeline_runs.job_num),
            text                     = COALESCE(EXCLUDED.text,     pipeline_runs.text),
            s1_enqueue_started_at    = COALESCE(EXCLUDED.s1_enqueue_started_at,    pipeline_runs.s1_enqueue_started_at),
            s1_enqueue_finished_at   = COALESCE(EXCLUDED.s1_enqueue_finished_at,   pipeline_runs.s1_enqueue_finished_at),
            s1_enqueue_ms            = COALESCE(EXCLUDED.s1_enqueue_ms,            pipeline_runs.s1_enqueue_ms),
            s1_queue_wait_started_at = COALESCE(EXCLUDED.s1_queue_wait_started_at, pipeline_runs.s1_queue_wait_started_at),
            s1_queue_wait_finished_at= COALESCE(EXCLUDED.s1_queue_wait_finished_at,pipeline_runs.s1_queue_wait_finished_at),
            s1_queue_wait_ms         = COALESCE(EXCLUDED.s1_queue_wait_ms,         pipeline_runs.s1_queue_wait_ms),
            s2_started_at            = COALESCE(EXCLUDED.s2_started_at,            pipeline_runs.s2_started_at),
            s2_finished_at           = COALESCE(EXCLUDED.s2_finished_at,           pipeline_runs.s2_finished_at),
            s2_ms                    = COALESCE(EXCLUDED.s2_ms,                    pipeline_runs.s2_ms),
            s3_started_at            = COALESCE(EXCLUDED.s3_started_at,            pipeline_runs.s3_started_at),
            s3_finished_at           = COALESCE(EXCLUDED.s3_finished_at,           pipeline_runs.s3_finished_at),
            s3_ms                    = COALESCE(EXCLUDED.s3_ms,                    pipeline_runs.s3_ms),
            s4_started_at            = COALESCE(EXCLUDED.s4_started_at,            pipeline_runs.s4_started_at),
            s4_finished_at           = COALESCE(EXCLUDED.s4_finished_at,           pipeline_runs.s4_finished_at),
            s4_ms                    = COALESCE(EXCLUDED.s4_ms,                    pipeline_runs.s4_ms),
            s5_started_at            = COALESCE(EXCLUDED.s5_started_at,            pipeline_runs.s5_started_at),
            s5_finished_at           = COALESCE(EXCLUDED.s5_finished_at,           pipeline_runs.s5_finished_at),
            s5_ms                    = COALESCE(EXCLUDED.s5_ms,                    pipeline_runs.s5_ms),
            s6_started_at            = COALESCE(EXCLUDED.s6_started_at,            pipeline_runs.s6_started_at),
            s6_finished_at           = COALESCE(EXCLUDED.s6_finished_at,           pipeline_runs.s6_finished_at),
            s6_ms                    = COALESCE(EXCLUDED.s6_ms,                    pipeline_runs.s6_ms),
            risk_tier                = COALESCE(EXCLUDED.risk_tier,                pipeline_runs.risk_tier),
            risk_score               = COALESCE(EXCLUDED.risk_score,               pipeline_runs.risk_score),
            fastapi_total_ms         = COALESCE(EXCLUDED.fastapi_total_ms,         pipeline_runs.fastapi_total_ms),
            is_complete              = EXCLUDED.is_complete OR pipeline_runs.is_complete,
            updated_at               = NOW()
    """), {
        "event_id":         event_id,
        "job_num":          _int(h.get("job_num")),
        "text":             h.get("text"),
        "s1e_start":        s1e_start,
        "s1e_end":          s1e_end,
        "s1_enqueue_ms":    s1_enqueue_ms,
        "s1q_start":        s1q_start,
        "s1q_end":          s1q_end,
        "s1_queue_wait_ms": s1_queue_wait_ms,
        "s2_start":         s2_start,
        "s2_end":           s2_end,
        "s2_ms":            s2_ms,
        "s3_start":         s3_start,
        "s3_end":           s3_end,
        "s3_ms":            s3_ms,
        "s4_start":         s4_start,
        "s4_end":           s4_end,
        "s4_ms":            s4_ms,
        "s5_start":         s5_start,
        "s5_end":           s5_end,
        "s5_ms":            s5_ms,
        "s6_start":         s6_start,
        "s6_end":           s6_end,
        "s6_ms":            s6_ms,
        "risk_tier":        h.get("risk_tier"),
        "risk_score":       risk_score,
        "fastapi_total_ms": fastapi_total_ms,
        "is_complete":      is_complete,
    })
    await db.commit()

    logger.info("pipeline_run flushed  event_id=%s  stages=%s  complete=%s",
                event_id, stages_written, is_complete)

    return FlushOut(status="flushed", event_id=event_id, stages_written=stages_written)


# ── Query endpoints ───────────────────────────────────────────────────────────

class PipelineRunOut(BaseModel):
    id:               int
    event_id:         str
    job_num:          Optional[int]
    text:             Optional[str]
    member_token:     Optional[str]
    risk_tier:        Optional[str]
    risk_score:       Optional[float]
    # durations
    s1_enqueue_ms:    Optional[int]
    s1_queue_wait_ms: Optional[int]
    s2_ms:            Optional[int]
    s3_ms:            Optional[int]
    s4_ms:            Optional[int]
    s5_ms:            Optional[int]
    s6_ms:            Optional[int]
    fastapi_total_ms: Optional[int]
    # start times
    s1_enqueue_started_at:     Optional[datetime]
    s1_queue_wait_started_at:  Optional[datetime]
    s2_started_at:             Optional[datetime]
    s3_started_at:             Optional[datetime]
    s4_started_at:             Optional[datetime]
    s5_started_at:             Optional[datetime]
    s6_started_at:             Optional[datetime]
    # end times
    s1_enqueue_finished_at:    Optional[datetime]
    s1_queue_wait_finished_at: Optional[datetime]
    s2_finished_at:            Optional[datetime]
    s3_finished_at:            Optional[datetime]
    s4_finished_at:            Optional[datetime]
    s5_finished_at:            Optional[datetime]
    s6_finished_at:            Optional[datetime]
    # meta
    is_complete:      bool
    has_error:        bool
    created_at:       datetime
    updated_at:       datetime

    class Config:
        from_attributes = True


@router.get("/runs", response_model=List[PipelineRunOut])
async def list_pipeline_runs(
    risk_tier:    Optional[str]  = Query(None),
    is_complete:  Optional[bool] = Query(None),
    member_token: Optional[str]  = Query(None),
    limit:        int            = Query(100, le=500),
    offset:       int            = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of pipeline runs, newest first."""
    from app.core.pipeline_run_model import PipelineRun
    q = select(PipelineRun).order_by(desc(PipelineRun.created_at))
    if risk_tier:    q = q.where(PipelineRun.risk_tier == risk_tier)
    if is_complete is not None: q = q.where(PipelineRun.is_complete == is_complete)
    if member_token: q = q.where(PipelineRun.member_token == member_token)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/runs/{event_id}", response_model=PipelineRunOut)
async def get_pipeline_run(event_id: str, db: AsyncSession = Depends(get_db)):
    """Full detail for a single pipeline run."""
    from app.core.pipeline_run_model import PipelineRun
    result = await db.execute(select(PipelineRun).where(PipelineRun.event_id == event_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=f"event_id '{event_id}' not found")
    return row


class StageStats(BaseModel):
    count: int
    min_ms:  Optional[float]
    avg_ms:  Optional[float]
    p90_ms:  Optional[float]
    max_ms:  Optional[float]


class PipelineStatsOut(BaseModel):
    total_runs:       int
    complete_runs:    int
    s1_enqueue:       StageStats
    s1_queue_wait:    StageStats
    s2_bullmq_fastapi: StageStats
    s3_llm_call:      StageStats
    s4_db_save:       StageStats
    s5_publish:       StageStats
    s6_e2e:           StageStats
    risk_distribution: dict


@router.get("/stats", response_model=PipelineStatsOut)
async def get_pipeline_stats(
    since: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate timing stats across all pipeline runs."""

    where = "WHERE 1=1"
    params: dict = {}
    if since:
        where += " AND created_at >= :since"
        params["since"] = since

    rows = await db.execute(text(f"""
        SELECT
            COUNT(*)                                          AS total_runs,
            COUNT(*) FILTER (WHERE is_complete)               AS complete_runs,
            -- s1 enqueue
            COUNT(s1_enqueue_ms)                              AS s1e_count,
            MIN(s1_enqueue_ms)                                AS s1e_min,
            AVG(s1_enqueue_ms)                                AS s1e_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s1_enqueue_ms)    AS s1e_p90,
            MAX(s1_enqueue_ms)                                AS s1e_max,
            -- s1 queue wait
            COUNT(s1_queue_wait_ms)                           AS s1q_count,
            MIN(s1_queue_wait_ms)                             AS s1q_min,
            AVG(s1_queue_wait_ms)                             AS s1q_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s1_queue_wait_ms) AS s1q_p90,
            MAX(s1_queue_wait_ms)                             AS s1q_max,
            -- s2
            COUNT(s2_ms)                                      AS s2_count,
            MIN(s2_ms)                                        AS s2_min,
            AVG(s2_ms)                                        AS s2_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s2_ms)            AS s2_p90,
            MAX(s2_ms)                                        AS s2_max,
            -- s3
            COUNT(s3_ms)                                      AS s3_count,
            MIN(s3_ms)                                        AS s3_min,
            AVG(s3_ms)                                        AS s3_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s3_ms)            AS s3_p90,
            MAX(s3_ms)                                        AS s3_max,
            -- s4
            COUNT(s4_ms)                                      AS s4_count,
            MIN(s4_ms)                                        AS s4_min,
            AVG(s4_ms)                                        AS s4_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s4_ms)            AS s4_p90,
            MAX(s4_ms)                                        AS s4_max,
            -- s5
            COUNT(s5_ms)                                      AS s5_count,
            MIN(s5_ms)                                        AS s5_min,
            AVG(s5_ms)                                        AS s5_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s5_ms)            AS s5_p90,
            MAX(s5_ms)                                        AS s5_max,
            -- s6
            COUNT(s6_ms)                                      AS s6_count,
            MIN(s6_ms)                                        AS s6_min,
            AVG(s6_ms)                                        AS s6_avg,
            PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s6_ms)            AS s6_p90,
            MAX(s6_ms)                                        AS s6_max
        FROM pipeline_runs
        {where}
    """), params)
    r = rows.one()

    dist_rows = await db.execute(text(f"""
        SELECT risk_tier, COUNT(*) AS cnt
        FROM pipeline_runs
        {where}
        WHERE risk_tier IS NOT NULL
        GROUP BY risk_tier
    """), params)
    dist = {row.risk_tier: row.cnt for row in dist_rows.fetchall()}

    def stage(count, mn, avg, p90, mx) -> StageStats:
        return StageStats(
            count  = count or 0,
            min_ms = float(mn)  if mn  is not None else None,
            avg_ms = float(avg) if avg is not None else None,
            p90_ms = float(p90) if p90 is not None else None,
            max_ms = float(mx)  if mx  is not None else None,
        )

    return PipelineStatsOut(
        total_runs    = r.total_runs,
        complete_runs = r.complete_runs,
        s1_enqueue    = stage(r.s1e_count, r.s1e_min, r.s1e_avg, r.s1e_p90, r.s1e_max),
        s1_queue_wait = stage(r.s1q_count, r.s1q_min, r.s1q_avg, r.s1q_p90, r.s1q_max),
        s2_bullmq_fastapi = stage(r.s2_count, r.s2_min, r.s2_avg, r.s2_p90, r.s2_max),
        s3_llm_call   = stage(r.s3_count, r.s3_min, r.s3_avg, r.s3_p90, r.s3_max),
        s4_db_save    = stage(r.s4_count, r.s4_min, r.s4_avg, r.s4_p90, r.s4_max),
        s5_publish    = stage(r.s5_count, r.s5_min, r.s5_avg, r.s5_p90, r.s5_max),
        s6_e2e        = stage(r.s6_count, r.s6_min, r.s6_avg, r.s6_p90, r.s6_max),
        risk_distribution = dist,
    )
