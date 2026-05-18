"""
crud.py
-------
All database read/write operations.
Routers call these functions — no SQL lives in routers.
"""

from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload

from app.core.models import (
    Member, InferenceEvent, EventSignal,
    ShapAttribution, ReviewAction, MemberRiskSnapshot,
)
from app.core.schemas import InferenceResultIn, ReviewIn


# ── Helper ────────────────────────────────────────────────────────────────────

async def get_or_create_member(db: AsyncSession, member_token: str, org_id: str) -> Member:
    result = await db.execute(select(Member).where(Member.member_token == member_token))
    member = result.scalar_one_or_none()
    if not member:
        member = Member(member_token=member_token, org_id=org_id)
        db.add(member)
        await db.flush()
    return member


# ── Save inference result ─────────────────────────────────────────────────────

async def save_inference_result(db: AsyncSession, data: InferenceResultIn) -> InferenceEvent:
    member = await get_or_create_member(db, data.member_token, data.org_id)

    event = InferenceEvent(
        event_id           = data.event_id,
        original_source_id = data.original_source_id,
        member_id          = member.id,
        org_id             = data.org_id,
        source_type        = data.source_type,
        event_timestamp    = data.event_timestamp,
        # source-specific
        group_id           = data.group_id,
        mood_score         = data.mood_score,
        session_id         = data.session_id,
        role               = data.role,
        instrument         = data.instrument,
        item_number        = data.item_number,
        # risk output
        risk_tier          = data.risk_tier,
        risk_score         = data.risk_score,
        risk_trend         = data.risk_trend,
        cultural_context   = data.cultural_context or [],
        recommended_action = data.recommended_action,
        review_deadline    = data.review_deadline,
        model_version      = data.model_version,
        clinician_reviewed = False,
    )
    db.add(event)
    await db.flush()

    for s in data.active_signals:
        db.add(EventSignal(
            event_id     = event.id,
            signal_code  = s.signal_code,
            signal_label = s.signal_label,
            confidence   = s.confidence,
            dimension    = s.dimension,
        ))

    for sh in data.shap_attributions:
        db.add(ShapAttribution(
            event_id    = event.id,
            span        = sh.span,
            weight      = sh.weight,
            signal_code = sh.signal_code,
            rank        = sh.rank,
        ))

    # Upsert member_risk_snapshot via the PL/pgSQL function (defined in V7 migration)
    await db.execute(
        text("SELECT upsert_member_risk_snapshot(:mid)"),
        {"mid": member.id},
    )

    await db.commit()
    return event


# ── Save review action ────────────────────────────────────────────────────────

async def save_review(db: AsyncSession, data: ReviewIn) -> ReviewAction:
    result = await db.execute(
        select(InferenceEvent).where(InferenceEvent.event_id == data.event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise ValueError(f"event_id '{data.event_id}' not found")

    member = await get_or_create_member(db, data.member_token, "")

    review = ReviewAction(
        review_id       = data.review_id,
        event_id        = event.id,
        member_id       = member.id,
        therapist_id    = data.therapist_id,
        action          = data.action,
        clinician_notes = data.clinician_notes,
        reviewed_at     = data.reviewed_at,
    )
    db.add(review)
    event.clinician_reviewed = True
    db.add(event)

    await db.commit()
    return review


# ── Dashboard: member results ─────────────────────────────────────────────────

async def get_member_results(
    db: AsyncSession,
    member_token: str,
    since: datetime = None,
    source: str = None,
    limit: int = 50,
):
    if since is None:
        since = datetime.now(timezone.utc) - timedelta(days=30)

    result = await db.execute(select(Member).where(Member.member_token == member_token))
    member = result.scalar_one_or_none()
    if not member:
        return None

    snap_result = await db.execute(
        select(MemberRiskSnapshot).where(MemberRiskSnapshot.member_id == member.id)
    )
    snapshot = snap_result.scalar_one_or_none()

    query = (
        select(InferenceEvent)
        .where(InferenceEvent.member_id == member.id)
        .where(InferenceEvent.event_timestamp >= since)
        .order_by(InferenceEvent.event_timestamp.desc())
        .limit(limit)
        .options(
            selectinload(InferenceEvent.signals),
            selectinload(InferenceEvent.shap_attributions),
        )
    )
    if source:
        query = query.where(InferenceEvent.source_type == source)

    events_result = await db.execute(query)
    events = events_result.scalars().all()

    return {"member": member, "snapshot": snapshot, "events": events}


# ── Dashboard: admin org summary ──────────────────────────────────────────────

async def get_admin_summary(db: AsyncSession, org_id: str):
    total = await db.execute(
        select(func.count(Member.id)).where(Member.org_id == org_id)
    )
    total_members = total.scalar() or 0

    analyzed = await db.execute(
        select(func.count(MemberRiskSnapshot.id))
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
    )
    members_analyzed = analyzed.scalar() or 0

    high_crisis = await db.execute(
        select(func.count(MemberRiskSnapshot.id))
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
        .where(MemberRiskSnapshot.current_risk_tier.in_(["high", "crisis"]))
    )
    high_crisis_count = high_crisis.scalar() or 0

    reviews = await db.execute(
        select(
            func.sum(MemberRiskSnapshot.pending_reviews),
            func.sum(MemberRiskSnapshot.overdue_reviews),
        )
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
    )
    pending, overdue = reviews.one()

    top_signals_result = await db.execute(
        text("""
            SELECT es.signal_code, es.signal_label,
                   COUNT(*)::float / NULLIF((
                       SELECT COUNT(*) FROM inference_events ie2
                       JOIN members m2 ON m2.id = ie2.member_id
                       WHERE m2.org_id = :org_id
                   ), 0) AS frequency
            FROM event_signals es
            JOIN inference_events ie ON ie.id = es.event_id
            JOIN members m ON m.id = ie.member_id
            WHERE m.org_id = :org_id
            GROUP BY es.signal_code, es.signal_label
            ORDER BY frequency DESC
            LIMIT 5
        """),
        {"org_id": org_id},
    )
    top_signals = top_signals_result.fetchall()

    dist_result = await db.execute(
        select(MemberRiskSnapshot.current_risk_tier, func.count(MemberRiskSnapshot.id))
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
        .group_by(MemberRiskSnapshot.current_risk_tier)
    )
    distribution = {"low": 0, "moderate": 0, "high": 0, "crisis": 0}
    for tier, count in dist_result.fetchall():
        if tier in distribution:
            distribution[tier] = count

    return {
        "org_id":            org_id,
        "total_members":     total_members,
        "members_analyzed":  members_analyzed,
        "high_crisis_members": high_crisis_count,
        "pending_reviews":   int(pending or 0),
        "overdue_reviews":   int(overdue or 0),
        "top_signals":       top_signals,
        "distribution":      distribution,
    }


# ── Dashboard: admin recent events ────────────────────────────────────────────

async def get_admin_recent_events(db: AsyncSession, org_id: str, limit: int = 50):
    query = (
        select(InferenceEvent, Member.member_token)
        .join(Member, Member.id == InferenceEvent.member_id)
        .where(Member.org_id == org_id)
        .order_by(InferenceEvent.event_timestamp.asc()) # Ascending so we can replay history in order
        .limit(limit)
        .options(
            selectinload(InferenceEvent.signals)
        )
    )
    result = await db.execute(query)
    rows = result.all()
    
    events = []
    for event, token in rows:
        events.append({
            "event": event,
            "member_token": token
        })
    return events
