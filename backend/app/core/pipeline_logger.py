"""
pipeline_logger.py
------------------
Writes one row to pipeline_stage_logs for each processing stage
of a sentiment-analysis request.

Stages logged for every /v1/ingest/* call:
  1  fastapi_received   — request arrived, body parsed
  2  consent_check      — consent gate result
  3  llm_call           — LLM inference completed (includes risk output)
  4  db_save            — background Postgres write completed
  5  response_sent      — 202 returned to the Node backend

Usage (from ingest.py):
    from app.core.pipeline_logger import log_stage

    await log_stage(
        event_id     = payload.event_id,
        member_token = payload.member_token,
        org_id       = payload.org_id,
        session_id   = payload.session_id,
        role         = payload.role,
        source_type  = "chat",
        stage_num    = 1,
        stage_name   = "fastapi_received",
        started_at   = t_received,
        finished_at  = datetime.now(timezone.utc),
        duration_ms  = ...,
        status       = "ok",
    )

All writes are fire-and-forget — a logging failure never affects
the actual request/response cycle.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, BigInteger, SmallInteger, String, Text, Numeric, TIMESTAMP
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def log_stage(
    *,
    event_id:      str,
    member_token:  str,
    org_id:        str,
    source_type:   str,
    stage_num:     int,
    stage_name:    str,
    started_at:    datetime,
    finished_at:   Optional[datetime] = None,
    duration_ms:   Optional[int]      = None,
    status:        str                = "ok",
    error_message: Optional[str]      = None,
    # optional context
    session_id:    Optional[str]      = None,
    role:          Optional[str]      = None,
    request_id:    Optional[str]      = None,
    # LLM result (stage 3 only)
    risk_tier:     Optional[str]      = None,
    risk_score:    Optional[float]    = None,
    risk_trend:    Optional[str]      = None,
) -> None:
    """
    Insert one pipeline_stage_logs row.
    Errors are caught and logged — never raised to the caller.
    """
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(
                _INSERT_SQL,
                {
                    "event_id":      event_id,
                    "request_id":    request_id,
                    "member_token":  member_token,
                    "org_id":        org_id,
                    "session_id":    session_id,
                    "role":          role,
                    "source_type":   source_type,
                    "stage_num":     stage_num,
                    "stage_name":    stage_name,
                    "started_at":    started_at,
                    "finished_at":   finished_at,
                    "duration_ms":   duration_ms,
                    "status":        status,
                    "error_message": error_message,
                    "risk_tier":     risk_tier,
                    "risk_score":    risk_score,
                    "risk_trend":    risk_trend,
                },
            )
            await db.commit()
    except Exception as exc:
        logger.warning("pipeline_stage_log write failed (stage=%s event=%s): %s",
                       stage_name, event_id, exc)


# ── Raw SQL insert (avoids importing the ORM model in a hot path) ─────────────
from sqlalchemy import text as _text

_INSERT_SQL = _text("""
    INSERT INTO pipeline_stage_logs (
        event_id, request_id,
        member_token, org_id, session_id, role, source_type,
        stage_num, stage_name,
        started_at, finished_at, duration_ms,
        status, error_message,
        risk_tier, risk_score, risk_trend
    ) VALUES (
        :event_id, :request_id,
        :member_token, :org_id, :session_id, :role, :source_type,
        :stage_num, :stage_name,
        :started_at, :finished_at, :duration_ms,
        :status, :error_message,
        :risk_tier, :risk_score, :risk_trend
    )
""")
