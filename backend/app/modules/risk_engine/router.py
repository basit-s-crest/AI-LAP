"""
router.py
---------
Risk Engine API endpoints.

GET  /v1/risk/member/{member_token}
    Full risk report for one member — composite score, source breakdown,
    signals, 7-day trend, recommended action.

POST /v1/risk/member/{member_token}/recalculate
    Force-recalculate and return a fresh report (same as GET, bypasses
    any future caching layer).

GET  /v1/risk/org/{org_id}/summary
    Risk distribution + per-member scores for an entire org.
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.risk_engine.report_builder import build_risk_report
from app.modules.risk_engine.tier import score_to_tier, tier_to_action, compute_trend
from app.modules.risk_engine.aggregator import compute_composite_score
from app.modules.risk_engine.schemas import RiskReport, OrgRiskSummary, OrgRiskMemberRow

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/risk", tags=["Risk Engine"])


# ── GET /v1/risk/member/{member_token} ────────────────────────────────────────

@router.get(
    "/member/{member_token}",
    response_model=RiskReport,
    summary="Full risk report for a member",
)
async def get_member_risk(
    member_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Computes the composite risk score for a member using all available
    data sources (chat/posts, mood, assessments). Returns the full
    breakdown with source contributions, top signals, and trend history.
    """
    report = await build_risk_report(db, member_token)

    if report is None:
        raise HTTPException(
            status_code=404,
            detail=f"No inference data found for member '{member_token}'. "
                   "Run at least one ingest call first.",
        )

    return report


# ── POST /v1/risk/member/{member_token}/recalculate ───────────────────────────

@router.post(
    "/member/{member_token}/recalculate",
    response_model=RiskReport,
    summary="Force-recalculate risk score for a member",
)
async def recalculate_member_risk(
    member_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Same as GET but semantically signals an intentional recalculation
    (useful for triggering from admin dashboards or webhooks).
    """
    report = await build_risk_report(db, member_token)

    if report is None:
        raise HTTPException(
            status_code=404,
            detail=f"No inference data found for member '{member_token}'.",
        )

    logger.info(
        "Risk recalculated | member=%s | tier=%s | score=%.3f",
        member_token, report.risk_tier, report.composite_score,
    )
    return report


# ── GET /v1/risk/org/{org_id}/summary ────────────────────────────────────────

@router.get(
    "/org/{org_id}/summary",
    response_model=OrgRiskSummary,
    summary="Risk distribution summary for an org",
)
async def get_org_risk_summary(
    org_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a risk summary for every member in the org:
    - Distribution across low / moderate / high / crisis
    - Per-member composite score + tier

    Uses the pre-aggregated member_risk_snapshots for speed,
    then augments with the risk engine's composite score per member.
    """
    # Fetch all members in org that have at least one inference event
    rows = await db.execute(text("""
        SELECT DISTINCT m.member_token
        FROM members m
        JOIN inference_events ie ON ie.member_id = m.id
        WHERE m.org_id = :org_id
        ORDER BY m.member_token
    """), {"org_id": org_id})

    member_tokens = [r.member_token for r in rows.fetchall()]

    if not member_tokens:
        return OrgRiskSummary(
            org_id=org_id,
            total_members=0,
            distribution={"low": 0, "moderate": 0, "high": 0, "crisis": 0},
            members=[],
        )

    distribution = {"low": 0, "moderate": 0, "high": 0, "crisis": 0}
    member_rows: list[OrgRiskMemberRow] = []

    for token in member_tokens:
        report = await build_risk_report(db, token)
        if report is None:
            continue

        distribution[report.risk_tier] = distribution.get(report.risk_tier, 0) + 1
        member_rows.append(OrgRiskMemberRow(
            member_token    = token,
            risk_tier       = report.risk_tier,
            composite_score = report.composite_score,
            risk_trend      = report.risk_trend,
            computed_at     = report.computed_at,
        ))

    # Sort by risk (crisis first) then score desc
    tier_order = {"crisis": 0, "high": 1, "moderate": 2, "low": 3}
    member_rows.sort(key=lambda m: (tier_order.get(m.risk_tier, 9), -m.composite_score))

    return OrgRiskSummary(
        org_id        = org_id,
        total_members = len(member_rows),
        distribution  = distribution,
        members       = member_rows,
    )

