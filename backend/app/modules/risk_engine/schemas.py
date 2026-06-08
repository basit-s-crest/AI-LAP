"""
schemas.py
----------
Pydantic response models for all risk engine API endpoints.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ── Source contribution breakdown ─────────────────────────────────────────────

class SourceContribution(BaseModel):
    """Score and weight contributed by one data source."""
    source:           str                  # chat_posts | mood | assessments | clinical
    weight:           float                # configured weight (0–1)
    raw_score:        Optional[float]      # weighted score before applying weight
    weighted_score:   Optional[float]      # raw_score * weight
    event_count:      int = 0             # how many events contributed
    available:        bool = True          # False if no data found for this source
    note:             Optional[str] = None # e.g. "floor applied" or "crisis override"


# ── Signal summary ────────────────────────────────────────────────────────────

class SignalSummary(BaseModel):
    signal_code:  str
    signal_label: Optional[str]
    dimension:    Optional[str]
    frequency:    int            # how many events had this signal
    avg_confidence: float


# ── Risk trend ────────────────────────────────────────────────────────────────

class TrendPoint(BaseModel):
    date:       str    # YYYY-MM-DD
    score:      float
    tier:       str
    event_count: int


# ── Main risk report ─────────────────────────────────────────────────────────

class RiskReport(BaseModel):
    member_token:       str
    org_id:             str
    computed_at:        datetime

    # ── Final composite score ─────────────────────────────────────────────────
    composite_score:    float = Field(ge=0.0, le=1.0)
    risk_tier:          str                            # low | moderate | high | crisis
    risk_trend:         str                            # stable | increasing | decreasing

    # ── Source breakdown ──────────────────────────────────────────────────────
    sources:            List[SourceContribution]

    # ── Override / floor flags ────────────────────────────────────────────────
    crisis_override_applied: bool = False
    floor_applied:           bool = False
    floor_reason:            Optional[str] = None

    # ── Top active signals ────────────────────────────────────────────────────
    top_signals:        List[SignalSummary] = []

    # ── 7-day trend history ───────────────────────────────────────────────────
    trend_history:      List[TrendPoint] = []

    # ── Recommended action ────────────────────────────────────────────────────
    recommended_action: str


# ── Org-level summary ────────────────────────────────────────────────────────

class OrgRiskMemberRow(BaseModel):
    member_token:    str
    risk_tier:       str
    composite_score: float
    risk_trend:      str
    computed_at:     datetime


class OrgRiskSummary(BaseModel):
    org_id:          str
    total_members:   int
    distribution:    Dict[str, int]   # {"low": n, "moderate": n, "high": n, "crisis": n}
    members:         List[OrgRiskMemberRow]
