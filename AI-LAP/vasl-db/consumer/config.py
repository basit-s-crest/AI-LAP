"""
config.py
---------
All configuration loaded from environment variables.
Never hardcode credentials — use .env locally, Secrets Manager in production.
"""

import os


# ── Kafka ──────────────────────────────────────────────────────────────────────
KAFKA_BOOTSTRAP_SERVERS: str = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
KAFKA_TOPIC_ANNOTATED: str   = os.getenv("KAFKA_TOPIC_ANNOTATED", "alap.text.annotated")
KAFKA_CONSUMER_GROUP: str    = os.getenv("KAFKA_CONSUMER_GROUP",  "vasl-dashboard-consumer")
KAFKA_SSL_CA_LOCATION: str   = os.getenv("KAFKA_SSL_CA_LOCATION", "")
KAFKA_POLL_TIMEOUT_S: float  = float(os.getenv("KAFKA_POLL_TIMEOUT_S", "1.0"))


# ── PostgreSQL ─────────────────────────────────────────────────────────────────
DB_HOST: str     = os.environ["DB_HOST"]
DB_PORT: int     = int(os.getenv("DB_PORT", "5432"))
DB_NAME: str     = os.environ["DB_NAME"]
DB_USER: str     = os.environ["DB_USER"]
DB_PASSWORD: str = os.environ["DB_PASSWORD"]
DB_SSLMODE: str  = os.getenv("DB_SSLMODE", "require")


# ── Redis (crisis alert pub/sub) ───────────────────────────────────────────────
REDIS_HOST: str = os.environ["REDIS_HOST"]
REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
REDIS_SSL: bool = os.getenv("REDIS_SSL", "true").lower() == "true"


# ── Crisis threshold ───────────────────────────────────────────────────────────
# Spec AC-S05: crisis-tier events must appear in dashboard within 90 seconds
CRISIS_SCORE_THRESHOLD: float = float(os.getenv("CRISIS_SCORE_THRESHOLD", "0.90"))
