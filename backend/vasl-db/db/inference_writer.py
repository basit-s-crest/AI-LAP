"""
db/inference_writer.py
----------------------
All PostgreSQL write operations for inference events.

Every message is written inside a single transaction — all inserts
succeed together or all roll back. No partial state.

Expected payload shape (produced by the AI inference service):

{
  "source_type":        "peer-post" | "journal" | "chat" | "assessment",
  "event_id":           "ing_...",
  "original_source_id": "post_...",
  "ingestion_id":       "ing_...",
  "org_id":             "org_...",
  "member_token":       "mbr_...",
  "timestamp":          "2026-...",

  -- source-specific (only present for the relevant source_type)
  "group_id":     "grp_..."           (peer-post)
  "mood_score":   3                   (journal)
  "session_id":   "sess_..."          (chat)
  "role":         "member"|"coach"    (chat)
  "instrument":   "PHQ8"|"GAD7"|"ACES"(assessment)
  "item_number":  1                   (assessment)

  "inference_result": {
    "risk_tier":          "low"|"moderate"|"high"|"crisis",
    "risk_score":         0.67,
    "risk_trend":         "stable"|"increasing"|"decreasing",
    "active_signals":     [...],
    "cultural_context":   [...],
    "shap_attributions":  [...],
    "recommended_action": "...",
    "model_version":      "1.0.0"
  },

  "processing_metadata": {
    "ingestion_id":    "ing_...",
    "processed_at":    "2026-...",
    "review_deadline": "2026-..."
  }
}
"""

import logging
from typing import Any

import psycopg2.extensions
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

# Maps the first 3 chars of a signal code to its dimension name
DIMENSION_MAP: dict[str, str] = {
    "HOP": "hopelessness",
    "ISO": "isolation",
    "SHA": "self_harm",
    "CRS": "crisis",
    "CCM": "cultural",
}


def save_inference_event(
    payload: dict[str, Any],
    conn: psycopg2.extensions.connection,
) -> None:
    """
    Persist one inference result into PostgreSQL.

    Steps (all inside one transaction):
      1. Upsert member
      2. Insert inference_event  — idempotent on event_id
      3. Insert event_signals
      4. Insert shap_attributions
      5. Upsert member_risk_snapshot via the DB stored function

    If the event_id already exists (replay / duplicate delivery),
    INSERT ... ON CONFLICT DO NOTHING skips it cleanly.
    """
    inference = payload["inference_result"]
    meta      = payload.get("processing_metadata", {})
    source    = payload.get("source_type", "")

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
                event_id,
                original_source_id,
                member_id,
                org_id,
                source_type,
                event_timestamp,

                group_id,
                mood_score,
                session_id,
                role,
                instrument,
                item_number,

                risk_tier,
                risk_score,
                risk_trend,
                cultural_context,
                recommended_action,
                clinician_reviewed,
                review_deadline,
                model_version
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                FALSE, %s, %s
            )
            ON CONFLICT (event_id) DO NOTHING
            RETURNING id
            """,
            (
                # core
                payload["event_id"],
                payload.get("original_source_id"),
                member_id,
                payload["org_id"],
                source,
                payload["timestamp"],

                # source-specific (NULL when not applicable)
                payload.get("group_id"),        # peer-post only
                payload.get("mood_score"),       # journal only
                payload.get("session_id"),       # chat only
                payload.get("role"),             # chat only
                payload.get("instrument"),       # assessment only
                payload.get("item_number"),      # assessment only

                # inference output
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
        # Explicit call as a safety net in case the DB trigger is ever
        # disabled during maintenance.
        cur.execute("SELECT upsert_member_risk_snapshot(%s)", (member_id,))

    conn.commit()

    logger.info(
        "Saved event_id=%s | source=%s | member=%s | tier=%s | score=%.3f",
        payload["event_id"],
        source,
        payload["member_token"],
        inference["risk_tier"],
        inference["risk_score"],
    )
