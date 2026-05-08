"""
kafka_producer.py
-----------------
Wraps the confluent-kafka Producer.

The ingestion gateway publishes one message per inbound request to the
alap.text.raw topic. The message carries the full request payload plus
a source_type tag so the preprocessing service knows which schema to
apply downstream.

Delivery guarantee: we use synchronous flush() after every produce()
so the HTTP 202 is only returned after Kafka has acknowledged the write.
If Kafka is unavailable the endpoint returns 503.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

from confluent_kafka import Producer, KafkaException

from config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC_RAW, KAFKA_SSL_CA_LOCATION

logger = logging.getLogger(__name__)

# Build producer config — omit SSL fields when running locally without certs
_producer_config: dict[str, Any] = {
    "bootstrap.servers":  KAFKA_BOOTSTRAP_SERVERS,
    "acks":               "all",   # wait for all in-sync replicas
    "retries":            3,
    "retry.backoff.ms":   200,
}

if KAFKA_SSL_CA_LOCATION:
    _producer_config.update({
        "security.protocol": "SSL",
        "ssl.ca.location":   KAFKA_SSL_CA_LOCATION,
    })

_producer: Producer | None = None


def get_producer() -> Producer:
    """Return the singleton Producer, creating it on first call."""
    global _producer
    if _producer is None:
        _producer = Producer(_producer_config)
    return _producer


def publish_raw_event(
    source_type: str,
    event_id:    str,
    payload:     dict[str, Any],
) -> None:
    """
    Publish one raw text event to alap.text.raw.

    The message key is the member_token so that all events for the same
    member land on the same Kafka partition — preserving ordering for
    that member's event stream.

    Raises KafkaException if delivery fails after retries.
    """
    producer = get_producer()

    message = {
        "source_type":    source_type,
        "event_id":       event_id,
        "published_at":   datetime.now(timezone.utc).isoformat(),
        **payload,
    }

    delivery_error: list[Exception] = []

    def _on_delivery(err, msg):
        if err:
            delivery_error.append(KafkaException(err))
            logger.error(
                "Kafka delivery failed | topic=%s event_id=%s error=%s",
                msg.topic(), event_id, err,
            )
        else:
            logger.info(
                "Kafka delivery OK | topic=%s partition=%d offset=%d event_id=%s",
                msg.topic(), msg.partition(), msg.offset(), event_id,
            )

    producer.produce(
        topic=KAFKA_TOPIC_RAW,
        key=payload.get("member_token", ""),
        value=json.dumps(message).encode("utf-8"),
        on_delivery=_on_delivery,
    )

    # Block until the broker acknowledges (or timeout after 10s)
    producer.flush(timeout=10)

    if delivery_error:
        raise delivery_error[0]
