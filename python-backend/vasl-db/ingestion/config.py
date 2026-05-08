"""
config.py
---------
Ingestion service configuration — all values from environment variables.
"""

import os

# ── Kafka ──────────────────────────────────────────────────────────────────────
KAFKA_BOOTSTRAP_SERVERS: str = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
KAFKA_TOPIC_RAW: str         = os.getenv("KAFKA_TOPIC_RAW", "alap.text.raw")
KAFKA_SSL_CA_LOCATION: str   = os.getenv("KAFKA_SSL_CA_LOCATION", "")

# ── Service ────────────────────────────────────────────────────────────────────
# Prefix for generated ingestion IDs
INGESTION_ID_PREFIX: str = os.getenv("INGESTION_ID_PREFIX", "ing")
