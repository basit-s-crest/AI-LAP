from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Optional

from database import get_db
from schemas import MemberResultOut, EventOut, SignalOut, ShapOut, AdminSummaryOut, TopSignalOut
import crud

router = APIRouter(prefix="/v1", tags=["dashboard"])


@router.get("/results/member/{member_token}", response_model=MemberResultOut)
async def get_member_results(
    member_token: str,
    since: Optional[datetime] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db)
):
    data = await crud.get_member_results(db, member_token, since, source, limit)

    if data is None:
        raise HTTPException(status_code=404, detail=f"Member '{member_token}' not found")

    snapshot = data["snapshot"]
    events   = data["events"]

    return MemberResultOut(
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
                        dimension    = s.dimension
                    ) for s in e.signals
                ],
                shap_attributions=[
                    ShapOut(
                        span        = sh.span,
                        weight      = float(sh.weight),
                        signal_code = sh.signal_code,
                        rank        = sh.rank
                    ) for sh in e.shap_attributions
                ]
            ) for e in events
        ]
    )


@router.get("/admin/summary/{org_id}", response_model=AdminSummaryOut)
async def get_admin_summary(
    org_id: str,
    db: AsyncSession = Depends(get_db)
):
    data = await crud.get_admin_summary(db, org_id)

    return AdminSummaryOut(
        org_id              = data["org_id"],
        total_members       = data["total_members"],
        high_crisis_members = data["high_crisis_members"],
        pending_reviews     = data["pending_reviews"],
        overdue_reviews     = data["overdue_reviews"],
        top_signals=[
            TopSignalOut(
                code      = row.signal_code,
                label     = row.signal_label,
                frequency = round(row.frequency, 4)
            ) for row in data["top_signals"]
        ]
    )