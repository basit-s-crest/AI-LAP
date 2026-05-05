from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from datetime import datetime
from sqlalchemy import func

from models import Member, InferenceEvent, EventSignal, ShapAttribution, ReviewAction
from schemas import InferenceResultIn, ReviewIn


# ── Helper: get or create member ─────────────────────────────────────────────

async def get_or_create_member(db: AsyncSession, member_token: str, org_id: str) -> Member:
    result = await db.execute(
        select(Member).where(Member.member_token == member_token)
    )
    member = result.scalar_one_or_none()

    if not member:
        member = Member(member_token=member_token, org_id=org_id)
        db.add(member)
        await db.flush()   # get the new id without committing

    return member


# ── Save inference result ─────────────────────────────────────────────────────

async def save_inference_result(db: AsyncSession, data: InferenceResultIn) -> InferenceEvent:
    # 1. Get or create the member row
    member = await get_or_create_member(db, data.member_token, data.org_id)

    # 2. Insert inference_events row
    event = InferenceEvent(
        event_id           = data.event_id,
        member_id          = member.id,
        org_id             = data.org_id,
        source_type        = data.source_type,
        event_timestamp    = data.event_timestamp,
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
    await db.flush()   # need event.id for child rows

    # 3. Insert event_signals rows
    for s in data.active_signals:
        db.add(EventSignal(
            event_id     = event.id,
            signal_code  = s.signal_code,
            signal_label = s.signal_label,
            confidence   = s.confidence,
            dimension    = s.dimension,
        ))

    # 4. Insert shap_attributions rows
    for sh in data.shap_attributions:
        db.add(ShapAttribution(
            event_id    = event.id,
            span        = sh.span,
            weight      = sh.weight,
            signal_code = sh.signal_code,
            rank        = sh.rank,
        ))

    # 5. Upsert member_risk_snapshots (pre-aggregated, fast dashboard reads)
    await db.execute(
        text("""
        INSERT INTO member_risk_snapshots (
            member_id, org_id,
            current_risk_tier, current_risk_score, risk_trend,
            total_events, high_crisis_event_count,
            avg_risk_score_7d, avg_risk_score_30d, max_risk_score_30d,
            latest_event_id, latest_event_at,
            pending_reviews, overdue_reviews,
            last_calculated_at, updated_at
        )
        SELECT
            m.id,
            m.org_id,
            latest.risk_tier,
            latest.risk_score,
            latest.risk_trend,
            COUNT(e.id),
            COUNT(e.id) FILTER (WHERE e.risk_tier IN ('high', 'crisis')),
            AVG(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '7 days'),
            AVG(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '30 days'),
            MAX(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '30 days'),
            latest.id,
            latest.event_timestamp,
            COUNT(e.id) FILTER (WHERE e.clinician_reviewed = FALSE),
            COUNT(e.id) FILTER (
                WHERE e.clinician_reviewed = FALSE AND e.review_deadline < NOW()
            ),
            NOW(), NOW()
        FROM members m
        JOIN inference_events e ON e.member_id = m.id
        JOIN LATERAL (
            SELECT * FROM inference_events
            WHERE member_id = m.id
            ORDER BY event_timestamp DESC
            LIMIT 1
        ) latest ON TRUE
        WHERE m.id = :member_id
        GROUP BY m.id, m.org_id, latest.id, latest.risk_tier,
                 latest.risk_score, latest.risk_trend, latest.event_timestamp
        ON CONFLICT (member_id) DO UPDATE SET
            current_risk_tier       = EXCLUDED.current_risk_tier,
            current_risk_score      = EXCLUDED.current_risk_score,
            risk_trend              = EXCLUDED.risk_trend,
            total_events            = EXCLUDED.total_events,
            high_crisis_event_count = EXCLUDED.high_crisis_event_count,
            avg_risk_score_7d       = EXCLUDED.avg_risk_score_7d,
            avg_risk_score_30d      = EXCLUDED.avg_risk_score_30d,
            max_risk_score_30d      = EXCLUDED.max_risk_score_30d,
            latest_event_id         = EXCLUDED.latest_event_id,
            latest_event_at         = EXCLUDED.latest_event_at,
            pending_reviews         = EXCLUDED.pending_reviews,
            overdue_reviews         = EXCLUDED.overdue_reviews,
            last_calculated_at      = NOW(),
            updated_at              = NOW()
        """),
        {"member_id": member.id}
    )

    await db.commit()
    return event


# ── Save review action ────────────────────────────────────────────────────────

async def save_review(db: AsyncSession, data: ReviewIn) -> ReviewAction:
    # Resolve event row id from event_id string
    result = await db.execute(
        select(InferenceEvent).where(InferenceEvent.event_id == data.event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise ValueError(f"event_id '{data.event_id}' not found")

    # Resolve member
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

    # Mark the event as reviewed
    event.clinician_reviewed = True
    db.add(event)

    await db.commit()
    return review

# ── Dashboard: fetch member results ──────────────────────────────────────────

async def get_member_results(
    db: AsyncSession,
    member_token: str,
    since: datetime = None,
    source: str = None,
    limit: int = 50
):
    from datetime import timezone, timedelta
    from sqlalchemy.orm import selectinload

    if since is None:
        since = datetime.now(timezone.utc) - timedelta(days=30)

    # Find member
    result = await db.execute(
        select(Member).where(Member.member_token == member_token)
    )
    member = result.scalar_one_or_none()
    if not member:
        return None

    # Get snapshot for summary
    from models import MemberRiskSnapshot
    snap_result = await db.execute(
        select(MemberRiskSnapshot).where(MemberRiskSnapshot.member_id == member.id)
    )
    snapshot = snap_result.scalar_one_or_none()

    # Build event query
    query = (
        select(InferenceEvent)
        .where(InferenceEvent.member_id == member.id)
        .where(InferenceEvent.event_timestamp >= since)
        .order_by(InferenceEvent.event_timestamp.desc())
        .limit(limit)
        .options(
            selectinload(InferenceEvent.signals),
            selectinload(InferenceEvent.shap_attributions)
        )
    )
    if source:
        query = query.where(InferenceEvent.source_type == source)

    events_result = await db.execute(query)
    events = events_result.scalars().all()

    return {
        "member": member,
        "snapshot": snapshot,
        "events": events
    }


# ── Dashboard: admin org summary ─────────────────────────────────────────────

async def get_admin_summary(db: AsyncSession, org_id: str):
    from models import MemberRiskSnapshot

    # Total members in org
    total = await db.execute(
        select(func.count(Member.id)).where(Member.org_id == org_id)
    )
    total_members = total.scalar()

    # High/crisis members
    high_crisis = await db.execute(
        select(func.count(MemberRiskSnapshot.id))
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
        .where(MemberRiskSnapshot.current_risk_tier.in_(["high", "crisis"]))
    )
    high_crisis_count = high_crisis.scalar()

    # Pending + overdue reviews
    reviews = await db.execute(
        select(
            func.sum(MemberRiskSnapshot.pending_reviews),
            func.sum(MemberRiskSnapshot.overdue_reviews)
        )
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
    )
    pending, overdue = reviews.one()

    # Top signals across org
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
        {"org_id": org_id}
    )
    top_signals = top_signals_result.fetchall()

    # Risk distribution breakdown
    dist_result = await db.execute(
        select(
            MemberRiskSnapshot.current_risk_tier,
            func.count(MemberRiskSnapshot.id)
        )
        .join(Member, Member.id == MemberRiskSnapshot.member_id)
        .where(Member.org_id == org_id)
        .group_by(MemberRiskSnapshot.current_risk_tier)
    )
    dist_rows = dist_result.fetchall()
    distribution = {"low": 0, "moderate": 0, "high": 0, "crisis": 0}
    for tier, count in dist_rows:
        if tier in distribution:
            distribution[tier] = count

    return {
        "org_id": org_id,
        "total_members": total_members or 0,
        "high_crisis_members": high_crisis_count or 0,
        "pending_reviews": int(pending or 0),
        "overdue_reviews": int(overdue or 0),
        "top_signals": top_signals
    }