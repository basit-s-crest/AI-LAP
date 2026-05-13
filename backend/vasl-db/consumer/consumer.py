"""
consumer.py
-----------
Kafka consumer — reads from alap.text.annotated and writes
structured inference results to PostgreSQL.

Key guarantees:
  - At-least-once delivery: Kafka offset is committed ONLY after
    a successful DB write. A crash mid-write causes redelivery,
    which is handled safely by the idempotent INSERT ON CONFLICT.
  - Crisis fast path: crisis-tier events are published to Redis
    pub/sub BEFORE the DB write to meet the 90-second SLA (AC-S05).
  - Single transaction per message: all DB inserts succeed together
    or all roll back — no partial state.
"""

import json
import logging
import signal
import sys
from typing import Any

from confluent_kafka import Consumer, KafkaError, KafkaException

import alerts
import db
from config import (
    KAFKA_BOOTSTRAP_SERVERS,
    KAFKA_TOPIC_ANNOTATED,
    KAFKA_CONSUMER_GROUP,
    KAFKA_SSL_CA_LOCATION,
    KAFKA_POLL_TIMEOUT_S,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


KAFKA_CONFIG = {
    "bootstrap.servers":  KAFKA_BOOTSTRAP_SERVERS,
    "group.id":           KAFKA_CONSUMER_GROUP,
    "auto.offset.reset":  "earliest",
    # Manual commit — only after DB write succeeds
    "enable.auto.commit": False,
}

# Only add SSL config when a CA cert path is provided
# (omitted in local dev, required in staging/production)
if KAFKA_SSL_CA_LOCATION:
    KAFKA_CONFIG.update({
        "security.protocol": "SSL",
        "ssl.ca.location":   KAFKA_SSL_CA_LOCATION,
    })


def process_message(payload: dict[str, Any], db_conn, redis_client) -> None:
    """
    Handle one Kafka message end-to-end:
      1. Crisis check → Redis alert (fast path, before DB write)
      2. DB write (members + inference_events + signals + SHAP + snapshot)
    """
    # ── Crisis fast path ──────────────────────────────────────────────────
    if alerts.is_crisis(payload):
        alerts.publish_crisis_alert(payload, redis_client)

    # ── Persist to PostgreSQL ─────────────────────────────────────────────
    db.save_inference_event(payload, db_conn)


def run() -> None:
    consumer     = Consumer(KAFKA_CONFIG)
    db_conn      = db.get_connection()
    redis_client = alerts.get_redis_client()

    # Graceful shutdown on SIGTERM / SIGINT
    running = True

    def _shutdown(signum, frame):
        nonlocal running
        logger.info("Shutdown signal received — draining and closing...")
        running = False

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    consumer.subscribe([KAFKA_TOPIC_ANNOTATED])
    logger.info("Subscribed to topic: %s", KAFKA_TOPIC_ANNOTATED)

    try:
        while running:
            msg = consumer.poll(timeout=KAFKA_POLL_TIMEOUT_S)

            if msg is None:
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    # End of partition — not an error, just wait for more messages
                    continue
                raise KafkaException(msg.error())

            try:
                payload = json.loads(msg.value().decode("utf-8"))
                process_message(payload, db_conn, redis_client)

                # Commit offset only after successful DB write
                # This is the at-least-once delivery guarantee
                consumer.commit(asynchronous=False)

            except json.JSONDecodeError as exc:
                logger.error(
                    "Malformed JSON in message offset=%s: %s",
                    msg.offset(), exc,
                )
                # Commit anyway — malformed messages can't be retried usefully
                consumer.commit(asynchronous=False)

            except Exception as exc:
                logger.error(
                    "Failed to process message offset=%s: %s",
                    msg.offset(), exc,
                    exc_info=True,
                )
                db_conn.rollback()
                # Do NOT commit offset — message will be redelivered on restart

    finally:
        consumer.close()
        db_conn.close()
        logger.info("Consumer shut down cleanly.")


if __name__ == "__main__":
    run()
