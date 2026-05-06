from fastapi import APIRouter, HTTPException
from schemas import PeerPostIn, JournalIn, ChatIn, AssessmentIn, IngestOut

router = APIRouter(prefix="/v1/ingest", tags=["ingest"])


def _consent_check(consent_active: bool, event_id: str):
    """Reject any event where consent is not active."""
    if not consent_active:
        raise HTTPException(
            status_code=403,
            detail=f"Consent not active for event {event_id}. Event rejected."
        )


def _push_to_kafka(source: str, event_id: str, payload: dict):
    """
    TODO: Replace this with real Kafka producer when Kafka is ready.
    For now, just prints so you can see it working locally.
    """
    print(f"[KAFKA] topic=alap.text.raw | source={source} | event_id={event_id}")
    # Real implementation will be:
    # producer.send("alap.text.raw", value=payload)


@router.post("/peer-post", response_model=IngestOut, status_code=202)
async def ingest_peer_post(payload: PeerPostIn):
    _consent_check(payload.consent_active, payload.event_id)
    _push_to_kafka("peer-post", payload.event_id, payload.model_dump())
    return IngestOut(status="queued", event_id=payload.event_id, source="peer-post")


@router.post("/journal", response_model=IngestOut, status_code=202)
async def ingest_journal(payload: JournalIn):
    _consent_check(payload.consent_active, payload.event_id)
    _push_to_kafka("journal", payload.event_id, payload.model_dump())
    return IngestOut(status="queued", event_id=payload.event_id, source="journal")


@router.post("/chat", response_model=IngestOut, status_code=202)
async def ingest_chat(payload: ChatIn):
    _consent_check(payload.consent_active, payload.event_id)
    _push_to_kafka("chat", payload.event_id, payload.model_dump())
    return IngestOut(status="queued", event_id=payload.event_id, source="chat")


@router.post("/assessment", response_model=IngestOut, status_code=202)
async def ingest_assessment(payload: AssessmentIn):
    _consent_check(payload.consent_active, payload.event_id)
    _push_to_kafka("assessment", payload.event_id, payload.model_dump())
    return IngestOut(status="queued", event_id=payload.event_id, source="assessment")