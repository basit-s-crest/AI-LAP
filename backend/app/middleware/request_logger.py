"""
request_logger.py
-----------------
FastAPI middleware that logs every incoming HTTP request to the
request_logs table in Postgres.

What gets captured per request:
  - HTTP method, path, query string, full URL
  - Client IP, User-Agent, Origin, Referer headers
  - Request body (JSON only, for POST/PUT/PATCH)
  - VASL-specific fields extracted from the body:
      event_id, member_token, org_id, source_type, session_id, role
  - HTTP response status code + response body (JSON only)
  - Timing: received_at, responded_at, duration_ms
  - Error flag + message if an exception was raised

Paths excluded from logging (health / docs / OpenAPI schema):
  /health, /docs, /redoc, /openapi.json, /favicon.ico

Usage — register in main.py:
    from app.middleware.request_logger import RequestLoggerMiddleware
    app.add_middleware(RequestLoggerMiddleware)
"""

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.database import AsyncSessionLocal
from app.modules.sentiment.request_log_model import RequestLog

logger = logging.getLogger(__name__)

# Paths that are never logged (noise / health checks / docs)
_SKIP_PATHS = frozenset({
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
})

# Source type inferred from the request path
_PATH_TO_SOURCE = {
    "/v1/ingest/chat":       "chat",
    "/v1/ingest/peer-post":  "peer-post",
    "/v1/ingest/journal":    "journal",
    "/v1/ingest/assessment": "assessment",
}


def _extract_client_ip(request: Request) -> Optional[str]:
    """Return the real client IP, respecting X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _infer_source_type(path: str) -> Optional[str]:
    """Map /v1/ingest/<type> → source type string."""
    return _PATH_TO_SOURCE.get(path)


async def _parse_json_body(body_bytes: bytes) -> Optional[dict]:
    """Try to parse bytes as JSON; return None on failure."""
    if not body_bytes:
        return None
    try:
        return json.loads(body_bytes.decode("utf-8"))
    except Exception:
        return None


class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """
    Starlette BaseHTTPMiddleware that writes one row to request_logs
    for every request that is not in _SKIP_PATHS.

    The DB write is fire-and-forget (errors are logged but never
    propagate to the caller).
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path

        # Skip noisy / internal paths
        if path in _SKIP_PATHS:
            return await call_next(request)

        request_id   = str(uuid.uuid4())
        received_at  = datetime.now(timezone.utc)
        t_start      = time.perf_counter()

        # ── Read request body (must be consumed before call_next) ──────────
        body_bytes: bytes = b""
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                body_bytes = await request.body()
            except Exception:
                pass

        # Re-inject body so the actual route handler can still read it
        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request._receive = receive  # type: ignore[attr-defined]

        # ── Parse body + extract VASL fields ───────────────────────────────
        request_body = await _parse_json_body(body_bytes)
        vasl: dict   = {}
        if isinstance(request_body, dict):
            vasl = {
                "event_id":     request_body.get("event_id"),
                "member_token": request_body.get("member_token"),
                "org_id":       request_body.get("org_id"),
                "session_id":   request_body.get("session_id"),
                "role":         request_body.get("role"),
            }
            
            # Do not store raw text in the database logs
            request_body.pop("text", None)
            request_body.pop("response_text", None)

        # ── Call the actual route ───────────────────────────────────────────
        status_code    = 500
        response_body  = None
        error_message  = None
        is_error       = False
        response_bytes = b""

        try:
            response = await call_next(request)
            status_code = response.status_code

            # Consume response body so we can log it
            async for chunk in response.body_iterator:
                response_bytes += chunk

            response_body = await _parse_json_body(response_bytes)

            # Rebuild the response with the already-consumed body
            response = Response(
                content=response_bytes,
                status_code=status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )

            if status_code >= 400:
                is_error = True
                if isinstance(response_body, dict):
                    error_message = response_body.get("detail") or str(response_body)

        except Exception as exc:
            is_error      = True
            error_message = str(exc)
            logger.exception("Unhandled exception in request %s %s", request.method, path)
            response = Response(
                content=json.dumps({"detail": "Internal Server Error"}).encode(),
                status_code=500,
                media_type="application/json",
            )

        # ── Timing ─────────────────────────────────────────────────────────
        duration_ms  = int((time.perf_counter() - t_start) * 1000)
        responded_at = datetime.now(timezone.utc)

        # ── Persist to DB (fire-and-forget) ────────────────────────────────
        try:
            await _write_log(
                request_id     = request_id,
                method         = request.method,
                path           = path,
                query_string   = str(request.url.query) or None,
                full_url       = str(request.url),
                client_ip      = _extract_client_ip(request),
                user_agent     = request.headers.get("user-agent"),
                origin         = request.headers.get("origin"),
                referer        = request.headers.get("referer"),
                request_body   = request_body,
                content_type   = request.headers.get("content-type"),
                content_length = int(request.headers.get("content-length", 0)) or None,
                event_id       = vasl.get("event_id"),
                member_token   = vasl.get("member_token"),
                org_id         = vasl.get("org_id"),
                source_type    = _infer_source_type(path),
                session_id     = vasl.get("session_id"),
                role           = vasl.get("role"),
                status_code    = status_code,
                response_body  = response_body,
                received_at    = received_at,
                responded_at   = responded_at,
                duration_ms    = duration_ms,
                error_message  = error_message,
                is_error       = is_error,
            )
        except Exception as log_exc:
            # Never let logging failures affect the actual response
            logger.warning("request_log write failed: %s", log_exc)

        return response


async def _write_log(**fields) -> None:
    """Insert one row into request_logs inside its own session."""
    async with AsyncSessionLocal() as db:
        db.add(RequestLog(**fields))
        await db.commit()



