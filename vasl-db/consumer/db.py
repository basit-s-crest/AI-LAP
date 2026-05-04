"""
db.py
-----
PostgreSQL connection and all write operations.
Every message is written inside a single transaction — all inserts
succeed together or all roll back. No partial state.
"""

import logging
from datetime import datetime
from typing import Any

import psycopg2
import psycopg2.extras
from psycopg2.extras import execute_values

from config import (
    DB_HOST, DB_PORT, DB_NAME,
    DB_USER, DB_PASSWORD, DB_SSLMODE,
)

logger = logging.getLogger(__name__)

# Maps the first 3 chars of a signal code to its dimension name
DIMENSION_MAP: dict[str, str] = {
    "HOP": "hopelessness",
    "ISO": "isolation",
    "SHA": "self_harm",
    "CRS": "crisis",
    "CCM": "cultural",
}


def get_connection() -> psycopg2.extensions.connection:
    """Open and return a new PostgreSQL connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
    )


def save_inference_event(payload: dict[str, Any], conn: psycopg2.extensions.connection) -> None:
    """
    Persist one inference result from the Kafka message into PostgreSQL.

    Steps (all inside one transaction):
      1. Upsert member (token may already exist from a prior event)
      2. Insert inference_event  — idempotent on event_id
      3. Insert event_signals
      4. Insert shap_attributions
      5. Upsert member_risk_snapshot via the DB function

    If the event_id already exists (Kafka replay / duplicate delivery),
    the INSERT ... ON CONFLICT DO NOTHING skips it cleanly.
    """
    inference = payload["inference_result"]
    meta      = payload["processing_metadata"]

    with conn.cursor() as cur:

        # ── 1. Upsert member ──────────────────────────────────────────────
        cur.execute(
            """
            INSERT INTO members (member_token, org_id)
            VALUES (%s, %s)
            ON CONFLICT (member_token) DO NOTHING
            RETURNING id
            """,
            (payload["member_token"], payload["org_id"]),
        )
        row = cur.fetchone()

        if row is None:
            # Member already existed — fetch their internal id
            cur.execute(
                "SELECT id FROM members WHERE member_token = %s",
                (payload["member_token"],),
            )
            row = cur.fetchone()

        member_id: int = row[0]

        # ── 2. Insert inference event ─────────────────────────────────────
        cur.execute(
            """
            INSERT INTO inference_events (
                event_id, member_id, org_id, source_type,
                event_timestamp, risk_tier, risk_score, risk_trend,
                cultural_context, recommended_action,
                clinician_reviewed, review_deadline, model_version
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                FALSE, %s, %s
            )
            ON CONFLICT (event_id) DO NOTHING
            RETURNING id
            """,
            (
                payload["event_id"],
                member_id,
                payload["org_id"],
                payload["source_type"],
                payload["timestamp"],
                inference["risk_tier"],
                inference["risk_score"],
                inference.get("risk_trend"),
                inference.get("cultural_context", []),
                inference.get("recommended_action"),
                meta.get("review_deadline"),
                inference.get("model_version"),
            ),
        )

        result = cur.fetchone()
        if result is None:
            # Duplicate event_id — already in DB, safe to skip
            logger.info("Duplicate event_id=%s — skipping", payload["event_id"])
            conn.rollback()
            return

        inference_event_db_id: int = result[0]

        # ── 3. Insert signals ─────────────────────────────────────────────
        signals = [
            (
                inference_event_db_id,
                s["code"],
                s.get("label"),
                s["confidence"],
                DIMENSION_MAP.get(s["code"][:3], "unknown"),
            )
            for s in inference.get("active_signals", [])
        ]

        if signals:
            execute_values(
                cur,
                """
                INSERT INTO event_signals
                    (event_id, signal_code, signal_label, confidence, dimension)
                VALUES %s
                """,
                signals,
            )

        # ── 4. Insert SHAP attributions ───────────────────────────────────
        shap_rows = [
            (
                inference_event_db_id,
                s["span"],
                s["weight"],
                s.get("signal"),
                s.get("rank"),
            )
            for s in inference.get("shap_attributions", [])
        ]

        if shap_rows:
            execute_values(
                cur,
                """
                INSERT INTO shap_attributions
                    (event_id, span, weight, signal_code, rank)
                VALUES %s
                """,
                shap_rows,
            )

        # ── 5. Refresh member risk snapshot ───────────────────────────────
        # Calls the PL/pgSQL function defined in V7 migration.
        # Recalculates all rolling stats for this member in one query.
        cur.execute("SELECT upsert_member_risk_snapshot(%s)", (member_id,))

    conn.commit()

    logger.info(
        "Saved event_id=%s | member=%s | tier=%s | score=%.3f",
        payload["event_id"],
        payload["member_token"],
        inference["risk_tier"],
        inference["risk_score"],
    )
