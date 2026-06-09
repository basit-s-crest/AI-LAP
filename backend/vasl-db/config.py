"""
config.py
---------
Central configuration for the vasl-db package.

All values are read from environment variables — never hardcoded.
Use .env locally, AWS Secrets Manager in staging/production.
"""

import os

# ── PostgreSQL ─────────────────────────────────────────────────────────────────
DB_HOST:     str = os.environ["DB_HOST"]
DB_PORT:     int = int(os.getenv("DB_PORT", "5432"))
DB_NAME:     str = os.environ["DB_NAME"]
DB_USER:     str = os.environ["DB_USER"]
DB_PASSWORD: str = os.environ["DB_PASSWORD"]
DB_SSLMODE:  str = os.getenv("DB_SSLMODE", "require")

# ── Redis (crisis alert pub/sub) ───────────────────────────────────────────────
REDIS_HOST: str  = os.environ["REDIS_HOST"]
REDIS_PORT: int  = int(os.getenv("REDIS_PORT", "6379"))
REDIS_SSL:  bool = os.getenv("REDIS_SSL", "true").lower() == "true"

# ── Crisis threshold ───────────────────────────────────────────────────────────
# Spec AC-S05: crisis-tier events must appear in dashboard within 90 seconds.
# Events at or above this score trigger an immediate Redis pub/sub alert.
CRISIS_SCORE_THRESHOLD: float = float(os.getenv("CRISIS_SCORE_THRESHOLD", "0.90"))
