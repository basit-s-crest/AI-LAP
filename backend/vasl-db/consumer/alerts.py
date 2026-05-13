"""
alerts.py
---------
Crisis alert fast path.

Spec AC-S05: crisis-tier events (score >= 0.90) must appear in the
therapist dashboard within 90 seconds of ingestion.

This module publishes to a Redis pub/sub channel immediately when a
crisis event is detected — before the full DB write completes.
The dashboard WebSocket subscribes to this channel and pushes the
alert to the browser in real time.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis

from config import (
    REDIS_HOST, REDIS_PORT, REDIS_SSL,
    CRISIS_SCORE_THRESHOLD,
)

logger = logging.getLogger(__name__)


def get_redis_client() -> redis.Redis:
    return redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        ssl=REDIS_SSL,
        decode_responses=True,
    )


def is_crisis(payload: dict[str, Any]) -> bool:
    """Return True if this event meets the crisis alert threshold."""
    inference = payload.get("inference_result", {})
    return (
        inference.get("risk_tier") == "crisis"
        or float(inference.get("risk_score", 0)) >= CRISIS_SCORE_THRESHOLD
    )


def publish_crisis_alert(payload: dict[str, Any], redis_client: redis.Redis) -> None:
    """
    Publish a crisis alert to the org-scoped Redis channel.
    Dashboard WebSocket consumers subscribe to: crisis_alerts:<org_id>
    """
    inference = payload["inference_result"]
    channel   = f"crisis_alerts:{payload['org_id']}"

    alert = {
        "event_id":          payload["event_id"],
        "member_token":      payload["member_token"],
        "risk_score":        inference["risk_score"],
        "risk_tier":         inference["risk_tier"],
        "recommended_action": inference.get("recommended_action"),
        "active_signals":    inference.get("active_signals", []),
        "cultural_context":  inference.get("cultural_context", []),
        "alerted_at":        datetime.now(timezone.utc).isoformat(),
        # Review deadline is 10 minutes for crisis tier (per spec)
        "review_deadline":   payload["processing_metadata"].get("review_deadline"),
    }

    redis_client.publish(channel, json.dumps(alert))

    logger.warning(
        "CRISIS ALERT published | channel=%s | event_id=%s | score=%.3f",
        channel,
        payload["event_id"],
        inference["risk_score"],
    )
