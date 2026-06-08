"""
report_builder.py
-----------------
Builds a complete RiskReport for one member by:
  1. Querying all inference events from the DB
  2. Running the composite score formula (aggregator)
  3. Computing risk trend (tier.py)
  4. Collecting top active signals
  5. Building a 7-day trend history (one data point per day)

This is the only file that touches the database — all math lives in
aggregator.py, decay.py, and tier.py.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.risk_engine.aggregator import compute_composite_score
from app.modules.risk_engine.tier import score_to_tier, tier_to_action, compute_trend
from app.modules.risk_engine.schemas import (
    RiskReport, SourceContribution, SignalSummary, TrendPoint,
)

logger = logging.getLogger(__name__)

# How many days of history to pull for the report
HISTORY_DAYS = 30


async def _fetch_events(db: AsyncSession, member_token: str) -> list[dict]:
    """
    Fetch all inference events for a member in the last HISTORY_DAYS days.
    Returns lightweight dicts (no ORM objects) for performance.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)

    rows = await db.execute(text("""
        SELECT
            ie.id,
            ie.event_id,
            ie.source_type,
            ie.event_timestamp,
            ie.risk_score,
            ie.risk_tier,
            ie.risk_trend,
            ie.mood_score,
            ie.instrument,
            ie.item_number,
            ie.org_id,
            m.member_token
        FROM inference_events ie
        JOIN members m ON m.id = ie.member_id
        WHERE m.member_token = :token
          AND ie.event_timestamp >= :cutoff
        ORDER BY ie.event_timestamp ASC
    """), {"token": member_token, "cutoff": cutoff})

    return [dict(r._mapping) for r in rows.fetchall()]


async def _fetch_signals(db: AsyncSession, member_token: str) -> list[dict]:
    """
    Fetch all signals for a member's events in the last HISTORY_DAYS days.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)

    rows = await db.execute(text("""
        SELECT
            es.signal_code,
            es.signal_label,
            es.dimension,
            es.confidence
        FROM event_signals es
        JOIN inference_events ie ON ie.id = es.event_id
        JOIN members m ON m.id = ie.member_id
        WHERE m.member_token = :token
          AND ie.event_timestamp >= :cutoff
    """), {"token": member_token, "cutoff": cutoff})

    return [dict(r._mapping) for r in rows.fetchall()]


def _build_signal_summaries(signals: list[dict], top_n: int = 5) -> list[SignalSummary]:
    """Roll up signals into frequency + average confidence per code."""
    grouped: dict[str, list] = defaultdict(list)
    labels: dict[str, str]   = {}
    dims:   dict[str, str]   = {}

    for s in signals:
        code = s["signal_code"]
        grouped[code].append(float(s.get("confidence") or 0.0))
        if s.get("signal_label"):
            labels[code] = s["signal_label"]
        if s.get("dimension"):
            dims[code] = s["dimension"]

    summaries = [
        SignalSummary(
            signal_code     = code,
            signal_label    = labels.get(code),
            dimension       = dims.get(code),
            frequency       = len(confs),
            avg_confidence  = round(sum(confs) / len(confs), 3),
        )
        for code, confs in grouped.items()
    ]

    # Sort by frequency desc, then avg_confidence desc
    summaries.sort(key=lambda s: (-s.frequency, -s.avg_confidence))
    return summaries[:top_n]


def _build_trend_history(events: list[dict]) -> list[TrendPoint]:
    """
    Group events by calendar day and return one TrendPoint per day
    (average score for that day) for the last 7 days.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent = [
        e for e in events
        if (e["event_timestamp"].replace(tzinfo=timezone.utc)
            if e["event_timestamp"].tzinfo is None
            else e["event_timestamp"]) >= cutoff
    ]

    by_day: dict[str, list[float]] = defaultdict(list)
    for e in recent:
        ts = e["event_timestamp"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        day = ts.date().isoformat()
        by_day[day].append(float(e.get("risk_score") or 0.0))

    points = []
    for day in sorted(by_day.keys()):
        scores = by_day[day]
        avg    = sum(scores) / len(scores)
        points.append(TrendPoint(
            date        = day,
            score       = round(avg, 3),
            tier        = score_to_tier(avg),
            event_count = len(scores),
        ))

    return points


async def build_risk_report(
    db: AsyncSession,
    member_token: str,
) -> Optional[RiskReport]:
    """
    Build and return a full RiskReport for the given member.
    Returns None if the member has no events.
    """

    # ── 1. Fetch raw data ─────────────────────────────────────────────────────
    events  = await _fetch_events(db, member_token)
    signals = await _fetch_signals(db, member_token)

    if not events:
        return None

    org_id = events[0]["org_id"]

    # ── 2. Compute composite score ────────────────────────────────────────────
    composite, sources, crisis_override, floor_applied, floor_reason = (
        compute_composite_score(events)
    )

    # ── 3. Risk tier + action ─────────────────────────────────────────────────
    tier   = score_to_tier(composite)
    action = tier_to_action(tier)

    # ── 4. Risk trend (from chronological score list) ─────────────────────────
    chrono_scores = [float(e.get("risk_score") or 0.0) for e in events]
    trend = compute_trend(chrono_scores)

    # ── 5. Top signals ────────────────────────────────────────────────────────
    top_signals = _build_signal_summaries(signals)

    # ── 6. 7-day trend history ────────────────────────────────────────────────
    trend_history = _build_trend_history(events)

    return RiskReport(
        member_token             = member_token,
        org_id                   = org_id,
        computed_at              = datetime.now(timezone.utc),
        composite_score          = round(composite, 4),
        risk_tier                = tier,
        risk_trend               = trend,
        sources                  = sources,
        crisis_override_applied  = crisis_override,
        floor_applied            = floor_applied,
        floor_reason             = floor_reason,
        top_signals              = top_signals,
        trend_history            = trend_history,
        recommended_action       = action,
    )

