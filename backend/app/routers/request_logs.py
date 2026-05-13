"""
request_logs.py
---------------
GET /v1/logs/requests — paginated list of all logged requests
GET /v1/logs/requests/{request_id} — single request detail
GET /v1/logs/stats — aggregate stats (counts, avg duration, error rate)

These endpoints let you inspect real frontend → python-backend traffic
directly from the database without needing Redis or JSONL files.
"""

from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc, Integer, cast
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.request_log_model import RequestLog

router = APIRouter(prefix="/v1/logs", tags=["Request Logs"])


# ── Response schemas ──────────────────────────────────────────────────────────

class RequestLogOut(BaseModel):
    id:             int
    request_id:     str
    method:         str
    path:           str
    query_string:   Optional[str]
    client_ip:      Optional[str]
    user_agent:     Optional[str]
    origin:         Optional[str]
    event_id:       Optional[str]
    member_token:   Optional[str]
    org_id:         Optional[str]
    source_type:    Optional[str]
    session_id:     Optional[str]
    role:           Optional[str]
    status_code:    int
    duration_ms:    Optional[int]
    received_at:    datetime
    responded_at:   Optional[datetime]
    is_error:       bool
    error_message:  Optional[str]

    class Config:
        from_attributes = True


class RequestLogDetailOut(RequestLogOut):
    full_url:       str
    referer:        Optional[str]
    content_type:   Optional[str]
    content_length: Optional[int]
    request_body:   Optional[dict]
    response_body:  Optional[dict]


class RequestLogStats(BaseModel):
    total_requests:     int
    total_errors:       int
    error_rate_pct:     float
    avg_duration_ms:    Optional[float]
    p90_duration_ms:    Optional[float]
    by_path:            List[dict]
    by_source_type:     List[dict]
    by_status_code:     List[dict]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/requests", response_model=List[RequestLogOut])
async def list_request_logs(
    path:         Optional[str]      = Query(None, description="Filter by path prefix"),
    method:       Optional[str]      = Query(None, description="GET | POST | …"),
    source_type:  Optional[str]      = Query(None, description="chat | peer-post | journal | assessment"),
    member_token: Optional[str]      = Query(None),
    org_id:       Optional[str]      = Query(None),
    is_error:     Optional[bool]     = Query(None, description="True = errors only"),
    since:        Optional[datetime] = Query(None, description="ISO 8601 start time"),
    until:        Optional[datetime] = Query(None, description="ISO 8601 end time"),
    limit:        int                = Query(100, le=500),
    offset:       int                = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Paginated list of logged requests, newest first.
    Supports filtering by path, method, source_type, member, error flag, and time range.
    """
    q = select(RequestLog).order_by(desc(RequestLog.received_at))

    if path:
        q = q.where(RequestLog.path.startswith(path))
    if method:
        q = q.where(RequestLog.method == method.upper())
    if source_type:
        q = q.where(RequestLog.source_type == source_type)
    if member_token:
        q = q.where(RequestLog.member_token == member_token)
    if org_id:
        q = q.where(RequestLog.org_id == org_id)
    if is_error is not None:
        q = q.where(RequestLog.is_error == is_error)
    if since:
        q = q.where(RequestLog.received_at >= since)
    if until:
        q = q.where(RequestLog.received_at <= until)

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/requests/{request_id}", response_model=RequestLogDetailOut)
async def get_request_log(
    request_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Full detail for a single logged request including body snapshots."""
    result = await db.execute(
        select(RequestLog).where(RequestLog.request_id == request_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"request_id '{request_id}' not found")
    return row


@router.get("/stats", response_model=RequestLogStats)
async def get_request_stats(
    since:  Optional[datetime] = Query(None, description="ISO 8601 start time"),
    org_id: Optional[str]      = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Aggregate stats over logged requests:
      - total count, error count, error rate
      - avg + p90 duration
      - breakdown by path, source_type, status_code
    """
    base_filter = []
    if since:
        base_filter.append(RequestLog.received_at >= since)
    if org_id:
        base_filter.append(RequestLog.org_id == org_id)

    # Total + error counts
    totals = await db.execute(
        select(
            func.count(RequestLog.id).label("total"),
            func.sum(cast(RequestLog.is_error, Integer)).label("errors"),
            func.avg(RequestLog.duration_ms).label("avg_ms"),
            func.percentile_cont(0.9).within_group(
                RequestLog.duration_ms.asc()
            ).label("p90_ms"),
        ).where(*base_filter)
    )
    row = totals.one()
    total      = row.total or 0
    errors     = int(row.errors or 0)
    avg_ms     = float(row.avg_ms) if row.avg_ms is not None else None
    p90_ms     = float(row.p90_ms) if row.p90_ms is not None else None
    error_rate = round((errors / total * 100), 2) if total else 0.0

    # By path
    by_path_q = await db.execute(
        select(RequestLog.path, func.count(RequestLog.id).label("count"))
        .where(*base_filter)
        .group_by(RequestLog.path)
        .order_by(desc("count"))
        .limit(20)
    )
    by_path = [{"path": r.path, "count": r.count} for r in by_path_q.fetchall()]

    # By source_type
    by_source_q = await db.execute(
        select(RequestLog.source_type, func.count(RequestLog.id).label("count"))
        .where(*base_filter)
        .where(RequestLog.source_type.isnot(None))
        .group_by(RequestLog.source_type)
        .order_by(desc("count"))
    )
    by_source = [{"source_type": r.source_type, "count": r.count} for r in by_source_q.fetchall()]

    # By status code
    by_status_q = await db.execute(
        select(RequestLog.status_code, func.count(RequestLog.id).label("count"))
        .where(*base_filter)
        .group_by(RequestLog.status_code)
        .order_by(desc("count"))
    )
    by_status = [{"status_code": r.status_code, "count": r.count} for r in by_status_q.fetchall()]

    return RequestLogStats(
        total_requests  = total,
        total_errors    = errors,
        error_rate_pct  = error_rate,
        avg_duration_ms = avg_ms,
        p90_duration_ms = p90_ms,
        by_path         = by_path,
        by_source_type  = by_source,
        by_status_code  = by_status,
    )
