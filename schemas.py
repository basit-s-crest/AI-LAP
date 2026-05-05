from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone

# ── Nested input models ──────────────────────────────────────────────────────

class SignalIn(BaseModel):
    signal_code:  str
    signal_label: Optional[str] = None
    confidence:   float = Field(ge=0.0, le=1.0)
    dimension:    Optional[str] = None   # hopelessness | isolation | self_harm | crisis | cultural


class ShapIn(BaseModel):
    span:        str               # max 5 words per spec
    weight:      float
    signal_code: Optional[str] = None
    rank:        Optional[int] = None


# ── Main inference result payload ────────────────────────────────────────────

class InferenceResultIn(BaseModel):
    """
    Payload sent to POST /v1/store-result after the LLM generates a response.
    Maps 1-to-1 with inference_events + child tables.
    """
    event_id:           str                        # evt_01HX... from source system
    member_token:       str                        # pseudonymized, e.g. mbr_a3f9c2d8e1
    org_id:             str
    source_type:        str                        # peer-post | journal | chat | assessment
    event_timestamp:    datetime                   # when the original text was created
    model_version:      Optional[str] = None

    # Risk output
    risk_tier:          str                        # low | moderate | high | crisis
    risk_score:         float = Field(ge=0.0, le=1.0)
    risk_trend:         Optional[str] = None       # stable | increasing | decreasing

    cultural_context:   List[str] = []             # ["AAVE_CODE_SWITCH", "MINIMIZATION"]
    recommended_action: Optional[str] = None
    review_deadline:    Optional[datetime] = None

    # Child rows
    active_signals:     List[SignalIn] = []
    shap_attributions:  List[ShapIn]   = []


class InferenceResultOut(BaseModel):
    status:   str
    event_id: str
    db_id:    int


# ── Review action payload ────────────────────────────────────────────────────

class ReviewIn(BaseModel):
    """
    Payload sent to POST /v1/review/action when a clinician submits a review.
    """
    review_id:       str                           # rev_01HX... from source system
    event_id:        str                           # event_id string (evt_01HX...)
    member_token:    str
    therapist_id:    str
    action:          str
    # contacted_member | scheduled_session | escalated_to_crisis
    # no_action_required | flagged_false_positive
    clinician_notes: Optional[str] = None
    reviewed_at:     datetime


class ReviewOut(BaseModel):
    status:    str
    review_id: str

# ── Ingest payloads (4 source types) ─────────────────────────────────────────

class PeerPostIn(BaseModel):
    event_id:       str
    org_id:         str
    member_token:   str
    group_id:       Optional[str] = None
    text:           str
    timestamp:      datetime
    consent_active: bool

class JournalIn(BaseModel):
    event_id:       str
    org_id:         str
    member_token:   str
    text:           str
    mood_score:     int = Field(ge=1, le=5)
    timestamp:      datetime
    consent_active: bool

class ChatIn(BaseModel):
    event_id:       str
    org_id:         str
    member_token:   str
    session_id:     str
    role:           str          # "member" or "coach"
    text:           str
    timestamp:      datetime
    consent_active: bool

class AssessmentIn(BaseModel):
    event_id:       str
    org_id:         str
    member_token:   str
    instrument:     str          # PHQ8 | GAD7 | ACES
    response_text:  str
    item_number:    int
    timestamp:      datetime
    consent_active: bool

class IngestOut(BaseModel):
    status:     str              # "queued"
    event_id:   str
    source:     str
    queued_at:    datetime = None

    def __init__(self, **data):
        if 'queued_at' not in data:
            data['queued_at'] = datetime.now(timezone.utc)
        super().__init__(**data)


# ── Dashboard response schemas ────────────────────────────────────────────────

class SignalOut(BaseModel):
    signal_code:  str
    signal_label: Optional[str]
    confidence:   float
    dimension:    Optional[str]

class ShapOut(BaseModel):
    span:         str
    weight:       float
    signal_code:  Optional[str]
    rank:         Optional[int]

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
    members_analyzed:    int        # ← add this
    risk_distribution:   RiskDistribution 
    high_crisis_members: int
    pending_reviews:     int
    overdue_reviews:     int
    top_signals:         List[TopSignalOut] = []