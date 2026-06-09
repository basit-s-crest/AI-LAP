"""
tier.py
-------
Risk tier classification and recommended action mapping.
"""

from app.modules.risk_engine.constants import TIER_CRISIS, TIER_HIGH, TIER_MODERATE


def score_to_tier(score: float) -> str:
    """Map a 0–1 composite score to a risk tier string."""
    if score >= TIER_CRISIS:
        return "crisis"
    if score >= TIER_HIGH:
        return "high"
    if score >= TIER_MODERATE:
        return "moderate"
    return "low"


def tier_to_action(tier: str) -> str:
    """Map a risk tier to the recommended clinical action."""
    return {
        "crisis":   "immediate_crisis_protocol",
        "high":     "urgent_clinician_review",
        "moderate": "schedule_followup",
        "low":      "no_action",
    }.get(tier, "no_action")


def compute_trend(scores: list[float]) -> str:
    """
    Given a chronological list of scores (oldest first, newest last),
    return 'increasing', 'decreasing', or 'stable'.

    Compares the average of the last 3 events vs the 3 before those.
    Falls back to 'stable' if fewer than 2 scores provided.
    """
    if len(scores) < 2:
        return "stable"

    recent = scores[-3:]
    prior  = scores[-6:-3] if len(scores) >= 4 else scores[:max(1, len(scores) - len(recent))]

    if not prior:
        return "stable"

    avg_recent = sum(recent) / len(recent)
    avg_prior  = sum(prior)  / len(prior)
    delta = avg_recent - avg_prior

    if delta > 0.05:
        return "increasing"
    if delta < -0.05:
        return "decreasing"
    return "stable"

