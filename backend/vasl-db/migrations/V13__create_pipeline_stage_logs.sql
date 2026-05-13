-- ============================================================
-- Migration V13: pipeline_stage_logs
--
-- One row per pipeline stage per event_id.
-- Captures fine-grained timing and status for each of the
-- 5 stages logged by pipeline_logger.py:
--
--   1  fastapi_received   — request arrived, body parsed
--   2  consent_check      — consent gate result
--   3  llm_call           — LLM inference completed
--   4  db_save            — background Postgres write completed
--   5  response_sent      — 202 returned to the Node backend
-- ============================================================

CREATE TABLE pipeline_stage_logs (
    id              BIGSERIAL    PRIMARY KEY,

    -- ── Identity ──────────────────────────────────────────────
    event_id        VARCHAR(64)  NOT NULL,
    request_id      VARCHAR(64),

    -- ── Caller context ────────────────────────────────────────
    member_token    VARCHAR(64)  NOT NULL,
    org_id          VARCHAR(64)  NOT NULL,
    session_id      VARCHAR(64),
    role            VARCHAR(16),
    source_type     VARCHAR(32)  NOT NULL,
    raw_text        TEXT,

    -- ── Stage identity ────────────────────────────────────────
    stage_num       SMALLINT     NOT NULL,
    stage_name      VARCHAR(64)  NOT NULL,

    -- ── Timing ────────────────────────────────────────────────
    started_at      TIMESTAMPTZ  NOT NULL,
    finished_at     TIMESTAMPTZ,
    duration_ms     INTEGER,

    -- ── Result ────────────────────────────────────────────────
    status          VARCHAR(16)  NOT NULL DEFAULT 'ok',
    error_message   TEXT,

    -- ── LLM output (stage 3 only) ─────────────────────────────
    risk_tier       VARCHAR(16),
    risk_score      NUMERIC(4,3),
    risk_trend      VARCHAR(16)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_psl_event_id     ON pipeline_stage_logs(event_id);
CREATE INDEX idx_psl_member_token ON pipeline_stage_logs(member_token);
CREATE INDEX idx_psl_started_at   ON pipeline_stage_logs(started_at DESC);
CREATE INDEX idx_psl_stage_name   ON pipeline_stage_logs(stage_name);
