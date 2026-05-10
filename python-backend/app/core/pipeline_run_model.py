"""
pipeline_run_model.py
---------------------
SQLAlchemy ORM model for pipeline_runs.
One row per event_id — all 6 pipeline stages as flat columns.
Used by the GET /v1/pipeline/runs endpoints.
"""

from sqlalchemy import (
    BigInteger, Boolean, Column, Integer, Numeric,
    SmallInteger, String, Text, TIMESTAMP,
)
from sqlalchemy import func
from app.core.database import Base


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id           = Column(BigInteger, primary_key=True)
    event_id     = Column(String(64), nullable=False, unique=True)
    job_num      = Column(Integer)
    text         = Column(Text)
    member_token = Column(String(64))
    org_id       = Column(String(64))
    session_id   = Column(String(64))
    role         = Column(String(16))
    source_type  = Column(String(32))

    # Stage [1a] frontend → BullMQ enqueue
    s1_enqueue_started_at  = Column(TIMESTAMP(timezone=True))
    s1_enqueue_finished_at = Column(TIMESTAMP(timezone=True))
    s1_enqueue_ms          = Column(Integer)

    # Stage [1b] BullMQ queue wait
    s1_queue_wait_started_at  = Column(TIMESTAMP(timezone=True))
    s1_queue_wait_finished_at = Column(TIMESTAMP(timezone=True))
    s1_queue_wait_ms          = Column(Integer)

    # Stage [2] worker → FastAPI HTTP
    s2_started_at  = Column(TIMESTAMP(timezone=True))
    s2_finished_at = Column(TIMESTAMP(timezone=True))
    s2_ms          = Column(Integer)

    # Stage [3] FastAPI LLM call
    s3_started_at  = Column(TIMESTAMP(timezone=True))
    s3_finished_at = Column(TIMESTAMP(timezone=True))
    s3_ms          = Column(Integer)

    # Stage [4] FastAPI background DB save
    s4_started_at  = Column(TIMESTAMP(timezone=True))
    s4_finished_at = Column(TIMESTAMP(timezone=True))
    s4_ms          = Column(Integer)

    # Stage [5] worker Redis publish
    s5_started_at  = Column(TIMESTAMP(timezone=True))
    s5_finished_at = Column(TIMESTAMP(timezone=True))
    s5_ms          = Column(Integer)

    # Stage [6] full end-to-end
    s6_started_at  = Column(TIMESTAMP(timezone=True))
    s6_finished_at = Column(TIMESTAMP(timezone=True))
    s6_ms          = Column(Integer)

    risk_tier        = Column(String(16))
    risk_score       = Column(Numeric(4, 3))
    risk_trend       = Column(String(16))
    fastapi_total_ms = Column(Integer)

    is_complete  = Column(Boolean, nullable=False, default=False)
    has_error    = Column(Boolean, nullable=False, default=False)
    error_stage  = Column(String(32))
    error_message = Column(Text)

    created_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
