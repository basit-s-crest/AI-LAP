from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Text,
    ARRAY, ForeignKey, TIMESTAMP
)
from sqlalchemy.orm import relationship
from sqlalchemy import func
from database import Base


class Member(Base):
    __tablename__ = "members"

    id           = Column(Integer, primary_key=True)
    member_token = Column(String(64), nullable=False, unique=True)
    org_id       = Column(String(64), nullable=False)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at   = Column(TIMESTAMP(timezone=True), server_default=func.now())

    inference_events    = relationship("InferenceEvent", back_populates="member", cascade="all, delete")
    risk_snapshot       = relationship("MemberRiskSnapshot", back_populates="member", uselist=False)
    review_actions      = relationship("ReviewAction", back_populates="member")


class InferenceEvent(Base):
    __tablename__ = "inference_events"

    id                 = Column(Integer, primary_key=True)
    event_id           = Column(String(64), nullable=False, unique=True)  # evt_01HX...
    member_id          = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    org_id             = Column(String(64), nullable=False)
    source_type        = Column(String(32), nullable=False)   # peer-post | journal | chat | assessment
    event_timestamp    = Column(TIMESTAMP(timezone=True), nullable=False)
    ingested_at        = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Risk output
    risk_tier          = Column(String(16), nullable=False)   # low | moderate | high | crisis
    risk_score         = Column(Numeric(4, 3), nullable=False) # 0.000 to 1.000
    risk_trend         = Column(String(16))                   # stable | increasing | decreasing

    # Cultural context stored as array
    cultural_context   = Column(ARRAY(Text))

    recommended_action = Column(String(64))
    clinician_reviewed = Column(Boolean, nullable=False, default=False)
    review_deadline    = Column(TIMESTAMP(timezone=True))
    model_version      = Column(String(16))
    created_at         = Column(TIMESTAMP(timezone=True), server_default=func.now())

    member             = relationship("Member", back_populates="inference_events")
    signals            = relationship("EventSignal", back_populates="event", cascade="all, delete")
    shap_attributions  = relationship("ShapAttribution", back_populates="event", cascade="all, delete")
    review_actions     = relationship("ReviewAction", back_populates="event", cascade="all, delete")


class EventSignal(Base):
    __tablename__ = "event_signals"

    id           = Column(Integer, primary_key=True)
    event_id     = Column(Integer, ForeignKey("inference_events.id", ondelete="CASCADE"), nullable=False)
    signal_code  = Column(String(16), nullable=False)   # e.g. ISO-04
    signal_label = Column(String(128))                   # e.g. "Social isolation — indirect"
    confidence   = Column(Numeric(4, 3), nullable=False)
    dimension    = Column(String(32))                    # hopelessness | isolation | self_harm | crisis | cultural

    event        = relationship("InferenceEvent", back_populates="signals")


class ShapAttribution(Base):
    __tablename__ = "shap_attributions"

    id          = Column(Integer, primary_key=True)
    event_id    = Column(Integer, ForeignKey("inference_events.id", ondelete="CASCADE"), nullable=False)
    span        = Column(String(64), nullable=False)    # max 5 words per spec
    weight      = Column(Numeric(5, 4), nullable=False)
    signal_code = Column(String(16))
    rank        = Column(Integer)                       # 1 = highest weight

    event       = relationship("InferenceEvent", back_populates="shap_attributions")


class ReviewAction(Base):
    __tablename__ = "review_actions"

    id              = Column(Integer, primary_key=True)
    review_id       = Column(String(64), nullable=False, unique=True)  # rev_01HX...
    event_id        = Column(Integer, ForeignKey("inference_events.id", ondelete="CASCADE"), nullable=False)
    member_id       = Column(Integer, ForeignKey("members.id"), nullable=False)
    therapist_id    = Column(String(64), nullable=False)
    action          = Column(String(64), nullable=False)
    # contacted_member | scheduled_session | escalated_to_crisis
    # no_action_required | flagged_false_positive
    clinician_notes = Column(Text)
    reviewed_at     = Column(TIMESTAMP(timezone=True), nullable=False)
    recorded_at     = Column(TIMESTAMP(timezone=True), server_default=func.now())

    event           = relationship("InferenceEvent", back_populates="review_actions")
    member          = relationship("Member", back_populates="review_actions")


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

    member                  = relationship("Member", back_populates="risk_snapshot")
