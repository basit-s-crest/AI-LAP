"""
models.py
---------
SQLAlchemy ORM models — mirror of vasl-db/migrations/ schema.

Columns match V1–V7 migrations exactly, including the source-specific
fields added in V2 (group_id, mood_score, session_id, role,
instrument, item_number, original_source_id).
"""

from sqlalchemy import (
    Column, Integer, SmallInteger, String, Numeric,
    Boolean, Text, ARRAY, ForeignKey, TIMESTAMP,
)
from sqlalchemy.orm import relationship
from sqlalchemy import func

from app.core.database import Base


# ── Members ───────────────────────────────────────────────────────────────────

class Member(Base):
    __tablename__ = "members"

    id           = Column(Integer, primary_key=True)
    member_token = Column(String(64), nullable=False, unique=True)
    org_id       = Column(String(64), nullable=False)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())

    inference_events = relationship("InferenceEvent", back_populates="member", cascade="all, delete")
    risk_snapshot    = relationship("MemberRiskSnapshot", back_populates="member", uselist=False)
    review_actions   = relationship("ReviewAction", back_populates="member")


# ── Inference Events ──────────────────────────────────────────────────────────

class InferenceEvent(Base):
    __tablename__ = "inference_events"

    id                 = Column(Integer, primary_key=True)
    event_id           = Column(String(64), nullable=False, unique=True)
    original_source_id = Column(String(64))                          # post_id / entry_id / etc.
    member_id          = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    org_id             = Column(String(64), nullable=False)
    source_type        = Column(String(32), nullable=False)           # peer-post | journal | chat | assessment
    event_timestamp    = Column(TIMESTAMP(timezone=True), nullable=False)
    ingested_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # ── Source-specific metadata (nullable — only set for relevant source) ──
    group_id    = Column(String(64))      # peer-post: which group
    mood_score  = Column(SmallInteger)    # journal: 1–5
    session_id  = Column(String(64))      # chat: session identifier
    role        = Column(String(16))      # chat: member | coach
    instrument  = Column(String(16))      # assessment: PHQ8 | GAD7 | ACES
    item_number = Column(SmallInteger)    # assessment: question number

    # ── Risk output ──────────────────────────────────────────────────────────
    risk_tier          = Column(String(16), nullable=False)           # low | moderate | high | crisis
    risk_score         = Column(Numeric(4, 3), nullable=False)        # 0.000 – 1.000
    risk_trend         = Column(String(16))                           # stable | increasing | decreasing
    cultural_context   = Column(ARRAY(Text))                          # ["AAVE_CODE_SWITCH", ...]
    recommended_action = Column(String(64))
    clinician_reviewed = Column(Boolean, nullable=False, default=False)
    review_deadline    = Column(TIMESTAMP(timezone=True))
    model_version      = Column(String(64))
    created_at         = Column(TIMESTAMP(timezone=True), server_default=func.now())

    member            = relationship("Member", back_populates="inference_events")
    signals           = relationship("EventSignal", back_populates="event", cascade="all, delete")
    shap_attributions = relationship("ShapAttribution", back_populates="event", cascade="all, delete")
    review_actions    = relationship("ReviewAction", back_populates="event", cascade="all, delete")


# ── Event Signals ─────────────────────────────────────────────────────────────

class EventSignal(Base):
    __tablename__ = "event_signals"

    id           = Column(Integer, primary_key=True)
    event_id     = Column(Integer, ForeignKey("inference_events.id", ondelete="CASCADE"), nullable=False)
    signal_code  = Column(String(16), nullable=False)
    signal_label = Column(String(128))
    confidence   = Column(Numeric(4, 3), nullable=False)
    dimension    = Column(String(32))   # hopelessness | isolation | self_harm | crisis | cultural

    event = relationship("InferenceEvent", back_populates="signals")


# ── SHAP Attributions ─────────────────────────────────────────────────────────

class ShapAttribution(Base):
    __tablename__ = "shap_attributions"

    id          = Column(Integer, primary_key=True)
    event_id    = Column(Integer, ForeignKey("inference_events.id", ondelete="CASCADE"), nullable=False)
    span        = Column(String(64), nullable=False)   # max 5 words per spec
    weight      = Column(Numeric(5, 4), nullable=False)
    signal_code = Column(String(16))
    rank        = Column(Integer)

    event = relationship("InferenceEvent", back_populates="shap_attributions")


# ── Review Actions ────────────────────────────────────────────────────────────

class ReviewAction(Base):
    __tablename__ = "review_actions"

    id              = Column(Integer, primary_key=True)
    review_id       = Column(String(64), nullable=False, unique=True)
    event_id        = Column(Integer, ForeignKey("inference_events.id", ondelete="CASCADE"), nullable=False)
    member_id       = Column(Integer, ForeignKey("members.id"), nullable=False)
    therapist_id    = Column(String(64), nullable=False)
    action          = Column(String(64), nullable=False)
    clinician_notes = Column(Text)
    reviewed_at     = Column(TIMESTAMP(timezone=True), nullable=False)
    recorded_at     = Column(TIMESTAMP(timezone=True), server_default=func.now())

    event  = relationship("InferenceEvent", back_populates="review_actions")
    member = relationship("Member", back_populates="review_actions")


# ── Member Risk Snapshots ─────────────────────────────────────────────────────

class MemberRiskSnapshot(Base):
    __tablename__ = "member_risk_snapshots"

    id                      = Column(Integer, primary_key=True)
    member_id               = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, unique=True)
    org_id                  = Column(String(64), nullable=False)
    therapist_id            = Column(String(64))

    current_risk_tier       = Column(String(16), nullable=False, default="low")
    current_risk_score      = Column(Numeric(4, 3))
    risk_trend              = Column(String(16))

    total_events            = Column(Integer, nullable=False, default=0)
    high_crisis_event_count = Column(Integer, nullable=False, default=0)
    avg_risk_score_7d       = Column(Numeric(4, 3))
    avg_risk_score_30d      = Column(Numeric(4, 3))
    max_risk_score_30d      = Column(Numeric(4, 3))

    latest_event_id         = Column(Integer, ForeignKey("inference_events.id"))
    latest_event_at         = Column(TIMESTAMP(timezone=True))

    pending_reviews         = Column(Integer, nullable=False, default=0)
    overdue_reviews         = Column(Integer, nullable=False, default=0)

    last_calculated_at      = Column(TIMESTAMP(timezone=True))
    updated_at              = Column(TIMESTAMP(timezone=True))

    member = relationship("Member", back_populates="risk_snapshot")
