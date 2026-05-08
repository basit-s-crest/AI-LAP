"""
main.py
-------
VASL ALAP Ingestion Gateway — FastAPI application.

Exposes 4 POST endpoints (one per source type). Each endpoint:
  1. Validates the request body via Pydantic
  2. Rejects immediately with 403 if consent_active is false
  3. Generates a unique ingestion_id
  4. Publishes the event to Kafka topic alap.text.raw
  5. Returns 202 Accepted

The AI inference service consumes from alap.text.raw, runs the
CulturalBERT-ALAP model, and publishes results to alap.text.annotated.
The consumer service (vasl-db/consumer/) reads from alap.text.annotated
and writes structured results to PostgreSQL.

No raw text is ever written to the database by this service.
"""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from confluent_kafka import KafkaException

from models import (
    PeerPostRequest,
    JournalRequest,
    ChatRequest,
    AssessmentRequest,
    IngestionAccepted,
    ConsentError,
)
from kafka_producer import publish_raw_event

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="VASL ALAP Ingestion Gateway",
    version="1.0.0",
    description=(
        "Receives text events from the Vasl platform, validates consent, "
        "and publishes to the Kafka event bus for AI inference."
    ),
    # Disable docs in production via env var if needed
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _new_ingestion_id() -> str:
    """Generate a unique ingestion ID."""
    return f"ing_{uuid.uuid4().hex[:20]}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _consent_check(consent_active: bool) -> None:
    """Raise 403 immediately if consent is not active."""
    if not consent_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error":   "consent_required",
                "message": "Member has not provided active consent for AI analysis.",
            },
        )


def _publish_and_respond(
    source_type: str,
    event_id:    str,
    payload:     dict,
) -> IngestionAccepted:
    """Publish to Kafka and return the 202 response. Raises 503 on Kafka failure."""
    ingestion_id = _new_ingestion_id()
    queued_at    = _now_iso()

    try:
        publish_raw_event(
            source_type=source_type,
            event_id=ingestion_id,   # ingestion_id is the Kafka message event_id
            payload={
                **payload,
                "original_source_id": event_id,  # preserve the caller's ID
                "ingestion_id":       ingestion_id,
            },
        )
    except KafkaException as exc:
        logger.error("Kafka publish failed for source=%s: %s", source_type, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error": "stream_unavailable", "message": "Event bus unavailable. Retry shortly."},
        )

    logger.info(
        "Queued | source=%s ingestion_id=%s member=%s",
        source_type, ingestion_id, payload.get("member_token"),
    )

    return IngestionAccepted(
        ingestion_id=ingestion_id,
        queued_at=queued_at,
        status="queued",
    )


# ── Health check ───────────────────────────────────────────────────────────────

@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


# ── Endpoint 1: Peer Group Post ────────────────────────────────────────────────

@app.post(
    "/v1/ingest/peer-post",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=IngestionAccepted,
    responses={
        403: {"model": ConsentError, "description": "Consent not active"},
        503: {"description": "Kafka unavailable"},
    },
    summary="Ingest a peer group post",
    tags=["Ingestion"],
)
def ingest_peer_post(body: PeerPostRequest):
    """
    Accepts a peer group post for AI analysis.

    - Rejects with 403 if consent_active is false
    - Publishes to alap.text.raw with source_type=peer-post
    - Returns 202 with ingestion_id
    """
    _consent_check(body.consent_active)

    return _publish_and_respond(
        source_type="peer-post",
        event_id=body.post_id,
        payload={
            "post_id":        body.post_id,
            "org_id":         body.org_id,
            "member_token":   body.member_token,
            "group_id":       body.group_id,
            "text":           body.text,
            "timestamp":      body.timestamp.isoformat(),
            "consent_active": body.consent_active,
        },
    )


# ── Endpoint 2: Mood Journal Entry ─────────────────────────────────────────────

@app.post(
    "/v1/ingest/journal",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=IngestionAccepted,
    responses={
        403: {"model": ConsentError, "description": "Consent not active"},
        503: {"description": "Kafka unavailable"},
    },
    summary="Ingest a mood journal entry",
    tags=["Ingestion"],
)
def ingest_journal(body: JournalRequest):
    """
    Accepts a mood journal entry for AI analysis.

    - Rejects with 403 if consent_active is false
    - Publishes to alap.text.raw with source_type=journal
    - Returns 202 with ingestion_id
    """
    _consent_check(body.consent_active)

    return _publish_and_respond(
        source_type="journal",
        event_id=body.entry_id,
        payload={
            "entry_id":       body.entry_id,
            "org_id":         body.org_id,
            "member_token":   body.member_token,
            "text":           body.text,
            "mood_score":     body.mood_score,
            "timestamp":      body.timestamp.isoformat(),
            "consent_active": body.consent_active,
        },
    )


# ── Endpoint 3: Coach Chat Message ─────────────────────────────────────────────

@app.post(
    "/v1/ingest/chat",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=IngestionAccepted,
    responses={
        403: {"model": ConsentError, "description": "Consent not active"},
        503: {"description": "Kafka unavailable"},
    },
    summary="Ingest a coach chat message",
    tags=["Ingestion"],
)
def ingest_chat(body: ChatRequest):
    """
    Accepts a coach chat message for AI analysis.

    Only member-role messages carry distress signals worth analyzing.
    Coach messages are still ingested (for session context) but the
    AI service applies lower weight to coach-role text.

    - Rejects with 403 if consent_active is false
    - Publishes to alap.text.raw with source_type=chat
    - Returns 202 with ingestion_id
    """
    _consent_check(body.consent_active)

    return _publish_and_respond(
        source_type="chat",
        event_id=body.message_id,
        payload={
            "message_id":     body.message_id,
            "session_id":     body.session_id,
            "org_id":         body.org_id,
            "member_token":   body.member_token,
            "role":           body.role,
            "text":           body.text,
            "timestamp":      body.timestamp.isoformat(),
            "consent_active": body.consent_active,
        },
    )


# ── Endpoint 4: Clinical Assessment Free Text ──────────────────────────────────

@app.post(
    "/v1/ingest/assessment",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=IngestionAccepted,
    responses={
        403: {"model": ConsentError, "description": "Consent not active"},
        503: {"description": "Kafka unavailable"},
    },
    summary="Ingest a clinical assessment free-text response",
    tags=["Ingestion"],
)
def ingest_assessment(body: AssessmentRequest):
    """
    Accepts a free-text response from a clinical assessment instrument
    (PHQ8, GAD7, or ACES) for AI analysis.

    - Rejects with 403 if consent_active is false
    - Publishes to alap.text.raw with source_type=assessment
    - Returns 202 with ingestion_id
    """
    _consent_check(body.consent_active)

    return _publish_and_respond(
        source_type="assessment",
        event_id=body.assessment_id,
        payload={
            "assessment_id":  body.assessment_id,
            "org_id":         body.org_id,
            "member_token":   body.member_token,
            "instrument":     body.instrument,
            "response_text":  body.response_text,
            "item_number":    body.item_number,
            "timestamp":      body.timestamp.isoformat(),
            "consent_active": body.consent_active,
        },
    )
