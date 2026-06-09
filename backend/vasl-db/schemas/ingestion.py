"""
schemas/ingestion.py
--------------------
Pydantic request and response schemas for all 4 ingestion source types.

Each source type has its own request model with exactly the fields
defined in the spec (Section 3.1). Shared response models live at the
bottom of this file.
"""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, field_validator


# ── Response models ────────────────────────────────────────────────────────────

class IngestionAccepted(BaseModel):
    """202 response — event queued successfully."""
    ingestion_id: str = Field(..., examples=["ing_01HX9Z..."])
    queued_at:    str = Field(..., examples=["2026-03-15T14:22:00.042Z"])
    status:       str = Field(default="queued")


class ConsentError(BaseModel):
    """403 response — consent_active was false."""
    error:   str = Field(default="consent_required")
    message: str = Field(
        default="Member has not provided active consent for AI analysis."
    )


# ── Peer Group Post ────────────────────────────────────────────────────────────

class PeerPostRequest(BaseModel):
    """POST /v1/ingest/peer-post"""
    post_id:        str      = Field(..., examples=["post_01HX..."])
    org_id:         str      = Field(..., examples=["org_univ_maryland"])
    member_token:   str      = Field(..., examples=["mbr_7c3a9f2e1b8d4c6a0e5f"])
    group_id:       str      = Field(..., examples=["grp_healing_community_001"])
    text:           str      = Field(..., max_length=2000)
    timestamp:      datetime = Field(..., examples=["2026-03-15T14:22:00Z"])
    consent_active: bool

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        return v


# ── Mood Journal Entry ─────────────────────────────────────────────────────────

class JournalRequest(BaseModel):
    """POST /v1/ingest/journal"""
    entry_id:       str      = Field(..., examples=["entry_01HX..."])
    org_id:         str      = Field(..., examples=["org_univ_maryland"])
    member_token:   str      = Field(..., examples=["mbr_7c3a9f2e1b8d4c6a0e5f"])
    text:           str      = Field(..., max_length=5000)
    mood_score:     int      = Field(..., ge=1, le=5, examples=[3])
    timestamp:      datetime = Field(..., examples=["2026-03-15T14:22:00Z"])
    consent_active: bool

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        return v


# ── Coach Chat Message ─────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    """POST /v1/ingest/chat"""
    message_id:     str                       = Field(..., examples=["msg_01HX..."])
    session_id:     str                       = Field(..., examples=["sess_01HX..."])
    org_id:         str                       = Field(..., examples=["org_univ_maryland"])
    member_token:   str                       = Field(..., examples=["mbr_7c3a9f2e1b8d4c6a0e5f"])
    role:           Literal["member", "coach"]
    text:           str                       = Field(..., max_length=500)
    timestamp:      datetime                  = Field(..., examples=["2026-03-15T14:22:00Z"])
    consent_active: bool

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        return v


# ── Clinical Assessment Free Text ──────────────────────────────────────────────

class AssessmentRequest(BaseModel):
    """POST /v1/ingest/assessment"""
    assessment_id:  str                           = Field(..., examples=["asmt_01HX..."])
    org_id:         str                           = Field(..., examples=["org_univ_maryland"])
    member_token:   str                           = Field(..., examples=["mbr_7c3a9f2e1b8d4c6a0e5f"])
    instrument:     Literal["PHQ8", "GAD7", "ACES"]
    response_text:  str                           = Field(..., max_length=5000)
    item_number:    int                           = Field(..., ge=1, examples=[3])
    timestamp:      datetime                      = Field(..., examples=["2026-03-15T14:22:00Z"])
    consent_active: bool

    @field_validator("response_text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("response_text must not be empty")
        return v
