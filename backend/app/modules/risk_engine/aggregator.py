"""
aggregator.py
-------------
Core risk computation engine.

Implements the composite score formula from the Risk Engine design doc:

  composite = (chat_posts_score   * WEIGHT_CHAT_POSTS)
            + (mood_score         * WEIGHT_MOOD)
            + (assessment_score   * WEIGHT_ASSESSMENTS)
            + (clinical_score     * WEIGHT_CLINICAL)   ← always 0.0 for now

Special rules applied after formula:
  1. Crisis override  — any single event ≥ 0.85 in last 24 h → composite = 1.0
  2. Floor rule       — PHQ-8 or GAD-7 total score ≥ 15 → composite ≥ 0.35

Each source returns a SourceContribution so callers can show a full
breakdown of where the score came from.
"""

from __future__ import annotations

import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Sequence

from app.modules.risk_engine.constants import (
    WEIGHT_CHAT_POSTS, WEIGHT_MOOD, WEIGHT_ASSESSMENTS, WEIGHT_CLINICAL,
    WEIGHT_CHANGE_INSIGHTS,
    HALF_LIFE_CHAT_DAYS, HALF_LIFE_ASSESSMENT_DAYS,
    HALF_LIFE_CHANGE_INSIGHT_DAYS,
    MOOD_WINDOW_DAYS, MOOD_SCORE_MIN, MOOD_SCORE_MAX,
    CRISIS_OVERRIDE_HOURS, FLOOR_PHQ_GAD_THRESHOLD, FLOOR_MODERATE_MIN,
    TIER_MODERATE,
)
from app.modules.risk_engine.decay import apply_decay, decay_weight
from app.modules.risk_engine.schemas import SourceContribution

logger = logging.getLogger(__name__)


# ── Data transfer objects (plain dicts from DB rows) ─────────────────────────
# We keep these as simple dicts to avoid importing ORM models here.
# Expected keys documented per function below.


def _safe_float(v, default: float = 0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


# ── 1. Chat & peer-post score ─────────────────────────────────────────────────

def compute_chat_posts_score(
    events: Sequence[dict],
) -> SourceContribution:
    """
    Compute a time-decayed weighted average of risk_score for
    source_type in ('chat', 'peer-post').

    Each event dict must have:
        risk_score      float 0–1
        event_timestamp datetime
    """
    relevant = [
        e for e in events
        if e.get("source_type") in ("chat", "peer-post")
    ]

    if not relevant:
        return SourceContribution(
            source="chat_posts", weight=WEIGHT_CHAT_POSTS,
            raw_score=None, weighted_score=None,
            event_count=0, available=False,
            note="no chat/peer-post events found",
        )

    total_weight = 0.0
    weighted_sum = 0.0

    for e in relevant:
        score  = _safe_float(e.get("risk_score"), 0.0)
        ts     = e["event_timestamp"]
        w      = decay_weight(ts, HALF_LIFE_CHAT_DAYS)
        weighted_sum   += score * w
        total_weight   += w

    raw = weighted_sum / total_weight if total_weight > 0 else 0.0
    raw = min(max(raw, 0.0), 1.0)

    return SourceContribution(
        source="chat_posts",
        weight=WEIGHT_CHAT_POSTS,
        raw_score=round(raw, 4),
        weighted_score=round(raw * WEIGHT_CHAT_POSTS, 4),
        event_count=len(relevant),
        available=True,
    )


# ── 2. Mood score ─────────────────────────────────────────────────────────────

def compute_mood_score(
    events: Sequence[dict],
) -> SourceContribution:
    """
    Average mood_score from journal entries in the last MOOD_WINDOW_DAYS days.
    mood_score 1–5 is inverted to a 0–1 risk scale:
        risk = (MAX - mood) / (MAX - MIN)   → mood=1 → risk=1.0, mood=5 → risk=0.0

    Each event dict must have:
        source_type     "journal"
        mood_score      int 1–5
        event_timestamp datetime
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=MOOD_WINDOW_DAYS)

    relevant = []
    for e in events:
        if e.get("source_type") != "journal":
            continue
        mood = e.get("mood_score")
        if mood is None:
            continue
        ts = e["event_timestamp"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts >= cutoff:
            relevant.append(mood)

    if not relevant:
        return SourceContribution(
            source="mood", weight=WEIGHT_MOOD,
            raw_score=None, weighted_score=None,
            event_count=0, available=False,
            note=f"no journal entries in last {MOOD_WINDOW_DAYS} days",
        )

    avg_mood = sum(relevant) / len(relevant)
    # Invert: mood=1 (worst) → risk=1.0, mood=5 (best) → risk=0.0
    raw = (MOOD_SCORE_MAX - avg_mood) / (MOOD_SCORE_MAX - MOOD_SCORE_MIN)
    raw = min(max(raw, 0.0), 1.0)

    return SourceContribution(
        source="mood",
        weight=WEIGHT_MOOD,
        raw_score=round(raw, 4),
        weighted_score=round(raw * WEIGHT_MOOD, 4),
        event_count=len(relevant),
        available=True,
    )


# ── 3. Assessment score ───────────────────────────────────────────────────────

# Max possible total scores per instrument
_INSTRUMENT_MAX = {
    "PHQ8":  24,   # PHQ-8: 8 items × 3 = 24
    "GAD7":  21,   # GAD-7: 7 items × 3 = 21
    "ACES":  10,   # ACEs: 10 items, binary
}

# Severity floors (used for the floor rule, not scoring)
_PHQ_GAD_FLOOR_THRESHOLD = FLOOR_PHQ_GAD_THRESHOLD  # 15


def compute_assessment_score(
    events: Sequence[dict],
) -> tuple[SourceContribution, bool]:
    """
    Time-decayed score from assessment events (PHQ8 / GAD7 / ACES).

    For each assessment instrument we:
      1. Group items by (instrument, session approximate date)
      2. Sum item-level risk_scores to get a total
      3. Normalise total against the instrument max
      4. Apply time decay (HALF_LIFE_ASSESSMENT_DAYS)
      5. Weighted average across all assessments

    Also checks the floor rule: if ANY assessment has a total score ≥
    FLOOR_PHQ_GAD_THRESHOLD → returns floor_triggered=True.

    Each event dict must have:
        source_type     "assessment"
        instrument      str  "PHQ8"|"GAD7"|"ACES"
        risk_score      float 0–1  (per-item LLM score)
        item_number     int
        event_timestamp datetime
    """
    relevant = [e for e in events if e.get("source_type") == "assessment"]

    if not relevant:
        return (
            SourceContribution(
                source="assessments", weight=WEIGHT_ASSESSMENTS,
                raw_score=None, weighted_score=None,
                event_count=0, available=False,
                note="no assessment events found",
            ),
            False,
        )

    # Group items by instrument + approximate session date (same calendar day)
    sessions: dict[tuple, list[dict]] = {}
    for e in relevant:
        instrument = (e.get("instrument") or "UNKNOWN").upper()
        ts = e["event_timestamp"]
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        day_key = ts.date().isoformat()
        key = (instrument, day_key)
        sessions.setdefault(key, []).append(e)

    total_weight  = 0.0
    weighted_sum  = 0.0
    floor_triggered = False

    for (instrument, day_key), items in sessions.items():
        # Sum risk_scores across items — use actual item scores, not scaled
        # risk_score here is LLM's 0-1 per-item score
        item_scores = [_safe_float(i.get("risk_score"), 0.0) for i in items]
        avg_item_score = sum(item_scores) / len(item_scores) if item_scores else 0.0

        # Check floor rule: convert avg back to raw score scale
        # PHQ-8/GAD-7: if sum of item_numbers * 3 * avg ≥ threshold, trigger floor
        instr_max = _INSTRUMENT_MAX.get(instrument, 10)
        n_items   = len(item_scores)
        estimated_total = avg_item_score * instr_max
        if instrument in ("PHQ8", "GAD7") and estimated_total >= _PHQ_GAD_FLOOR_THRESHOLD:
            floor_triggered = True

        # Use the timestamp of the most recent item in the session for decay
        ts_list = [i["event_timestamp"] for i in items]
        ts_list = [t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t for t in ts_list]
        most_recent_ts = max(ts_list)

        w = decay_weight(most_recent_ts, HALF_LIFE_ASSESSMENT_DAYS)
        weighted_sum  += avg_item_score * w
        total_weight  += w

    raw = weighted_sum / total_weight if total_weight > 0 else 0.0
    raw = min(max(raw, 0.0), 1.0)

    return (
        SourceContribution(
            source="assessments",
            weight=WEIGHT_ASSESSMENTS,
            raw_score=round(raw, 4),
            weighted_score=round(raw * WEIGHT_ASSESSMENTS, 4),
            event_count=len(relevant),
            available=True,
            note="floor triggered (PHQ/GAD ≥ 15)" if floor_triggered else None,
        ),
        floor_triggered,
    )


# ── 4. Clinical notes (stub — not yet available) ──────────────────────────────

def compute_clinical_score() -> SourceContribution:
    return SourceContribution(
        source="clinical",
        weight=WEIGHT_CLINICAL,
        raw_score=None,
        weighted_score=None,
        event_count=0,
        available=False,
        note="not yet available — weight redistributed to other sources",
    )


# ── 4.5. Change Insights score ────────────────────────────────────────────────

def compute_change_insights_score(
    events: Sequence[dict],
) -> SourceContribution:
    """
    Compute a time-decayed weighted average of risk_score for
    source_type == 'change-insight'.

    Each event dict must have:
        risk_score      float 0–1
        event_timestamp datetime
    """
    relevant = [
        e for e in events
        if e.get("source_type") == "change-insight"
    ]

    if not relevant:
        return SourceContribution(
            source="change_insights", weight=WEIGHT_CHANGE_INSIGHTS,
            raw_score=None, weighted_score=None,
            event_count=0, available=False,
            note="no change-insight events found",
        )

    total_weight = 0.0
    weighted_sum = 0.0

    for e in relevant:
        score  = _safe_float(e.get("risk_score"), 0.0)
        ts     = e["event_timestamp"]
        w      = decay_weight(ts, HALF_LIFE_CHANGE_INSIGHT_DAYS)
        weighted_sum   += score * w
        total_weight   += w

    raw = weighted_sum / total_weight if total_weight > 0 else 0.0
    raw = min(max(raw, 0.0), 1.0)

    return SourceContribution(
        source="change_insights",
        weight=WEIGHT_CHANGE_INSIGHTS,
        raw_score=round(raw, 4),
        weighted_score=round(raw * WEIGHT_CHANGE_INSIGHTS, 4),
        event_count=len(relevant),
        available=True,
    )



# ── 5. Crisis override ────────────────────────────────────────────────────────

def check_crisis_override(events: Sequence[dict]) -> bool:
    """
    Return True if ANY event in the last CRISIS_OVERRIDE_HOURS hours
    has risk_score >= 0.85 (the crisis threshold).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=CRISIS_OVERRIDE_HOURS)
    for e in events:
        ts = e.get("event_timestamp")
        if ts is None:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        score = _safe_float(e.get("risk_score"), 0.0)
        if ts >= cutoff and score >= 0.85:
            return True
    return False


# ── 6. Composite score ────────────────────────────────────────────────────────

def compute_composite_score(
    events: Sequence[dict],
) -> tuple[float, list[SourceContribution], bool, bool, str | None]:
    """
    Main entry point. Given a list of raw inference event dicts for ONE member,
    compute the composite risk score and return:

        (composite_score, source_contributions, crisis_override, floor_applied, floor_reason)

    composite_score is 0.0–1.0 (clipped).
    """

    # ── Compute per-source scores ─────────────────────────────────────────────
    chat_contrib           = compute_chat_posts_score(events)
    mood_contrib           = compute_mood_score(events)
    assessment_contrib, floor_triggered = compute_assessment_score(events)
    change_insight_contrib = compute_change_insights_score(events)
    clinical_contrib       = compute_clinical_score()

    sources = [chat_contrib, mood_contrib, assessment_contrib, change_insight_contrib, clinical_contrib]

    # ── Weighted sum of available sources only ────────────────────────────────
    # If a source has no data (available=False), its weight is NOT counted
    # in the denominator — we renormalise on the fly.
    total_active_weight = 0.0
    raw_sum             = 0.0

    for s in sources:
        if s.available and s.raw_score is not None:
            total_active_weight += s.weight
            raw_sum             += s.raw_score * s.weight

    if total_active_weight > 0:
        composite = raw_sum / total_active_weight   # renormalise
    else:
        composite = 0.0

    composite = min(max(composite, 0.0), 1.0)

    # ── Crisis override (rule 1) ──────────────────────────────────────────────
    crisis_override = check_crisis_override(events)
    if crisis_override:
        composite = 1.0
        for s in sources:
            if s.available:
                s.note = (s.note or "") + " [crisis override applied]"

    # ── Floor rule (rule 2) ───────────────────────────────────────────────────
    floor_applied = False
    floor_reason  = None
    if not crisis_override and floor_triggered and composite < FLOOR_MODERATE_MIN:
        composite     = FLOOR_MODERATE_MIN
        floor_applied = True
        floor_reason  = f"PHQ-8 or GAD-7 ≥ {FLOOR_PHQ_GAD_THRESHOLD} — score floored at {FLOOR_MODERATE_MIN}"

    return composite, sources, crisis_override, floor_applied, floor_reason

