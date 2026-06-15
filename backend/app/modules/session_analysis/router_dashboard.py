"""
dashboard.py
------------
GET /v1/results/member/{member_token} — therapist member view
GET /v1/admin/summary/{org_id}        — admin org summary

Both endpoints are Redis-cached (TTL from CACHE_TTL env var, default 60s).
Cache is busted automatically when a new event is ingested for that member.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.modules.session_analysis.schemas import (
    MemberResultOut, EventOut, SignalOut, ShapOut,
    AdminSummaryOut, TopSignalOut, RiskDistribution, AdminRecentEventOut,
)
from app.modules.session_analysis import crud
from app.modules.session_analysis.cache import (
    get_member_cache, set_member_cache,
    get_admin_cache, set_admin_cache,
)

router = APIRouter(prefix="/v1", tags=["Dashboard"])


@router.get("/results/member/{member_token}", response_model=MemberResultOut)
async def get_member_results(
    member_token: str,
    since:  Optional[datetime] = Query(None, description="ISO 8601 start date"),
    source: Optional[str]      = Query(None, description="peer-post | journal | chat | assessment"),
    limit:  int                = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns risk summary + event history for a single member.
    Used by the therapist dashboard. Redis-cached per member token.
    """
    # Only cache the default (no filters) request to keep it simple
    use_cache = since is None and source is None and limit == 50
    cache_key = member_token

    if use_cache:
        cached = await get_member_cache(cache_key)
        if cached is not None:
            return MemberResultOut(**cached)

    data = await crud.get_member_results(db, member_token, since, source, limit)

    if data is None:
        raise HTTPException(status_code=404, detail=f"Member '{member_token}' not found")

    snapshot = data["snapshot"]
    events   = data["events"]

    result = MemberResultOut(
        member_token       = member_token,
        current_risk_tier  = snapshot.current_risk_tier  if snapshot else None,
        current_risk_score = float(snapshot.current_risk_score) if snapshot and snapshot.current_risk_score else None,
        risk_trend         = snapshot.risk_trend          if snapshot else None,
        total_events       = snapshot.total_events        if snapshot else 0,
        pending_reviews    = snapshot.pending_reviews     if snapshot else 0,
        events=[
            EventOut(
                event_id           = e.event_id,
                source_type        = e.source_type,
                event_timestamp    = e.event_timestamp,
                risk_tier          = e.risk_tier,
                risk_score         = float(e.risk_score),
                risk_trend         = e.risk_trend,
                recommended_action = e.recommended_action,
                clinician_reviewed = e.clinician_reviewed,
                signals=[
                    SignalOut(
                        signal_code  = s.signal_code,
                        signal_label = s.signal_label,
                        confidence   = float(s.confidence),
                        dimension    = s.dimension,
                    )
                    for s in e.signals
                ],
                shap_attributions=[
                    ShapOut(
                        span        = sh.span,
                        weight      = float(sh.weight),
                        signal_code = sh.signal_code,
                        rank        = sh.rank,
                    )
                    for sh in e.shap_attributions
                ],
            )
            for e in events
        ],
    )

    if use_cache:
        await set_member_cache(cache_key, result.model_dump())

    return result


@router.get("/admin/summary/{org_id}", response_model=AdminSummaryOut)
async def get_admin_summary(
    org_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns aggregate risk distribution for an org.
    No individual member data — admin dashboard only. Redis-cached per org.
    """
    cached = await get_admin_cache(org_id)
    if cached is not None:
        return AdminSummaryOut(**cached)

    data = await crud.get_admin_summary(db, org_id)

    result = AdminSummaryOut(
        org_id              = data["org_id"],
        total_members       = data["total_members"],
        members_analyzed    = data["members_analyzed"],
        risk_distribution   = RiskDistribution(**data["distribution"]),
        high_crisis_members = data["high_crisis_members"],
        pending_reviews     = data["pending_reviews"],
        overdue_reviews     = data["overdue_reviews"],
        top_signals=[
            TopSignalOut(
                code      = row.signal_code,
                label     = row.signal_label,
                frequency = round(row.frequency, 4),
            )
            for row in data["top_signals"]
        ],
    )

    await set_admin_cache(org_id, result.model_dump())

    return result


@router.get("/admin/events/{org_id}", response_model=list[AdminRecentEventOut])
async def get_admin_recent_events(
    org_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the most recent risk events across an organization.
    Useful for hydrating the live dashboard on page reload.
    """
    rows = await crud.get_admin_recent_events(db, org_id, limit)
    
    result = []
    for row in rows:
        event = row["event"]
        token = row["member_token"]
        
        result.append(
            AdminRecentEventOut(
                member_token       = token,
                event_id           = event.event_id,
                source_type        = event.source_type,
                event_timestamp    = event.event_timestamp,
                risk_tier          = event.risk_tier,
                risk_score         = float(event.risk_score),
                risk_trend         = event.risk_trend,
                recommended_action = event.recommended_action,
                active_signals     = [
                    SignalOut(
                        signal_code  = s.signal_code,
                        signal_label = s.signal_label,
                        confidence   = float(s.confidence),
                        dimension    = s.dimension,
                    ) for s in event.signals
                ] if event.signals else []
            )
        )
        
    return result



