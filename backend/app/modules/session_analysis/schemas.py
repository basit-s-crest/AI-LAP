"""
schemas.py
----------
Pydantic request/response models for all API endpoints.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone


# ── Shared signal / SHAP models ───────────────────────────────────────────────

class SignalIn(BaseModel):
    signal_code:  str
    signal_label: Optional[str] = None
    confidence:   float = Field(ge=0.0, le=1.0)
    dimension:    Optional[str] = None


class ShapIn(BaseModel):
    span:        str
    weight:      float
    signal_code: Optional[str] = None
    rank:        Optional[int] = None


# ── Store: inference result ───────────────────────────────────────────────────

class InferenceResultIn(BaseModel):
    """POST /v1/store-result — save AI inference output to DB."""
    model_config = {"protected_namespaces": ()}

    event_id:           str
    member_token:       str
    org_id:             str
    source_type:        str                        # peer-post | journal | chat | assessment
    event_timestamp:    datetime
    model_version:      Optional[str] = None

    # Source-specific context (optional — only relevant field will be set)
    original_source_id: Optional[str] = None
    group_id:           Optional[str] = None       # peer-post
    mood_score:         Optional[int] = Field(None, ge=1, le=5)  # journal
    session_id:         Optional[str] = None       # chat
    role:               Optional[str] = None       # chat: member | coach
    instrument:         Optional[str] = None       # assessment: PHQ8 | GAD7 | ACES
    item_number:        Optional[int] = None       # assessment

    # Risk output
    risk_tier:          str
    risk_score:         float = Field(ge=0.0, le=1.0)
    risk_trend:         Optional[str] = None
    cultural_context:   List[str] = []
    recommended_action: Optional[str] = None
    review_deadline:    Optional[datetime] = None

    # Child rows
    active_signals:    List[SignalIn] = []
    shap_attributions: List[ShapIn]   = []


class InferenceResultOut(BaseModel):
    status:   str
    event_id: str
    db_id:    int


# ── Store: review action ──────────────────────────────────────────────────────

class ReviewIn(BaseModel):
    """POST /v1/review/action — clinician submits a review."""
    review_id:       str
    event_id:        str
    member_token:    str
    therapist_id:    str
    action:          str   # contacted_member | scheduled_session | escalated_to_crisis | no_action_required | flagged_false_positive
    clinician_notes: Optional[str] = None
    reviewed_at:     datetime


class ReviewOut(BaseModel):
    status:    str
    review_id: str


# ── Ingest: 4 source types ────────────────────────────────────────────────────

class PeerPostIn(BaseModel):
    """POST /v1/ingest/peer-post"""
    event_id:       str
    org_id:         str
    member_token:   str
    group_id:       Optional[str] = None
    text:           str = Field(..., max_length=2000)
    timestamp:      datetime
    consent_active: bool


class JournalIn(BaseModel):
    """POST /v1/ingest/journal"""
    event_id:       str
    org_id:         str
    member_token:   str
    text:           str = Field(..., max_length=5000)
    mood_score:     int = Field(..., ge=1, le=5)
    timestamp:      datetime
    consent_active: bool


class ChatIn(BaseModel):
    """POST /v1/ingest/chat"""
    event_id:       str
    org_id:         str
    member_token:   str
    session_id:     str
    role:           Literal["member", "coach"]
    text:           str = Field(..., max_length=500)
    timestamp:      datetime
    consent_active: bool
    original_source_id: Optional[str] = None


class AssessmentIn(BaseModel):
    """POST /v1/ingest/assessment"""
    event_id:       str
    org_id:         str
    member_token:   str
    instrument:     Literal["PHQ8", "GAD7", "ACES"]
    response_text:  str = Field(..., max_length=5000)
    item_number:    int = Field(..., ge=1)
    timestamp:      datetime
    consent_active: bool


class ChangeInsightIn(BaseModel):
    """POST /v1/ingest/change-insight"""
    event_id:       str
    org_id:         str
    member_token:   str
    text:           str = Field(..., max_length=10000)
    timestamp:      datetime
    consent_active: bool
    original_source_id: Optional[str] = None



class IngestOut(BaseModel):
    status:          str
    event_id:        str
    source:          str
    queued_at:       datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # Returned immediately after LLM responds (before DB save completes)
    risk_tier:       Optional[str]   = None
    risk_score:      Optional[float] = None
    risk_trend:      Optional[str]   = None
    recommended_action: Optional[str] = None
    active_signals:  List[SignalIn]  = []
    # Timing fields — worker uses these to log stages [3] and [4]
    timing_llm_ms:   Optional[int]   = None   # how long the LLM call took
    timing_total_ms: Optional[int]   = None   # total FastAPI processing time


# ── Dashboard: response models ────────────────────────────────────────────────

class SignalOut(BaseModel):
    signal_code:  str
    signal_label: Optional[str]
    confidence:   float
    dimension:    Optional[str]


class ShapOut(BaseModel):
    span:        str
    weight:      float
    signal_code: Optional[str]
    rank:        Optional[int]


class EventOut(BaseModel):
    event_id:           str
    source_type:        str
    event_timestamp:    datetime
    risk_tier:          str
    risk_score:         float
    risk_trend:         Optional[str]
    recommended_action: Optional[str]
    clinician_reviewed: bool
    signals:            List[SignalOut] = []
    shap_attributions:  List[ShapOut]  = []


class MemberResultOut(BaseModel):
    member_token:       str
    current_risk_tier:  Optional[str]
    current_risk_score: Optional[float]
    risk_trend:         Optional[str]
    total_events:       int
    pending_reviews:    int
    events:             List[EventOut] = []


class TopSignalOut(BaseModel):
    code:      str
    label:     Optional[str]
    frequency: float


class RiskDistribution(BaseModel):
    low:      int = 0
    moderate: int = 0
    high:     int = 0
    crisis:   int = 0


class AdminSummaryOut(BaseModel):
    org_id:              str
    total_members:       int
    members_analyzed:    int
    risk_distribution:   RiskDistribution
    high_crisis_members: int
    pending_reviews:     int
    overdue_reviews:     int
    top_signals:         List[TopSignalOut] = []


class AdminRecentEventOut(BaseModel):
    member_token:       str
    event_id:           str
    source_type:        str
    event_timestamp:    datetime
    risk_tier:          str
    risk_score:         float
    risk_trend:         Optional[str]
    recommended_action: Optional[str]
    active_signals:     List[SignalOut] = []

