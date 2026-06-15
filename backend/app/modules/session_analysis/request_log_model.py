"""
request_log_model.py
--------------------
SQLAlchemy ORM model for the request_logs table.

Every HTTP request that hits the FastAPI server (port 8000) is
captured here — including caller context, VASL-specific payload
fields, response status, and timing.
"""

from sqlalchemy import (
    BigInteger, Boolean, Column, Integer, SmallInteger,
    String, Text, TIMESTAMP,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import func

from app.core.database import Base


class RequestLog(Base):
    __tablename__ = "request_logs"

    id             = Column(BigInteger, primary_key=True)

    # ── Request identity ──────────────────────────────────────
    request_id     = Column(String(64),  nullable=False, unique=True)
    method         = Column(String(10),  nullable=False)
    path           = Column(Text,        nullable=False)
    query_string   = Column(Text)
    full_url       = Column(Text,        nullable=False)

    # ── Caller context ────────────────────────────────────────
    client_ip      = Column(String(64))
    user_agent     = Column(Text)
    origin         = Column(Text)
    referer        = Column(Text)

    # ── Request body snapshot ─────────────────────────────────
    request_body   = Column(JSONB)
    content_type   = Column(String(128))
    content_length = Column(Integer)

    # ── VASL-specific fields extracted from body ──────────────
    event_id       = Column(String(64))
    member_token   = Column(String(64))
    org_id         = Column(String(64))
    source_type    = Column(String(32))
    session_id     = Column(String(64))
    role           = Column(String(16))

    # ── Response ──────────────────────────────────────────────
    status_code    = Column(SmallInteger, nullable=False, default=0)
    response_body  = Column(JSONB)

    # ── Timing ────────────────────────────────────────────────
    received_at    = Column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    responded_at   = Column(TIMESTAMP(timezone=True))
    duration_ms    = Column(Integer)

    # ── Error capture ─────────────────────────────────────────
    error_message  = Column(Text)
    is_error       = Column(Boolean, nullable=False, default=False)
