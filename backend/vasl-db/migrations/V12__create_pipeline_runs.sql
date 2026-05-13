-- ============================================================
-- Migration V12: pipeline_runs
--
-- One row per event_id — captures every stage of the full
-- frontend → BullMQ → worker → FastAPI → LLM → DB → publish
-- → SSE pipeline.
--
-- Stage ownership:
--   [1a] test_pipeline / frontend  s1_enqueue_*
--   [1b] worker.mjs                s1_queue_wait_*
--   [2]  worker.mjs                s2_bullmq_to_fastapi_*
--   [3]  FastAPI                   s3_llm_*
--   [4]  FastAPI (background)      s4_db_*
--   [5]  worker.mjs                s5_publish_*
--   [6]  test_pipeline / frontend  s6_e2e_*
--
-- Each stage stores:
--   _started_at   TIMESTAMPTZ  — wall-clock start
--   _finished_at  TIMESTAMPTZ  — wall-clock end
--   _ms           INTEGER      — duration in milliseconds
--
-- The row is created when stage [1] is first written and
-- updated (upserted) as each subsequent stage completes.
-- ============================================================

CREATE TABLE pipeline_runs (
    id              BIGSERIAL    PRIMARY KEY,

    -- ── Identity ──────────────────────────────────────────────
    event_id        VARCHAR(64)  NOT NULL UNIQUE,
    job_num         INTEGER,                        -- sequential job number from test_pipeline
    text            TEXT,                           -- the raw message text

    -- ── Caller context ────────────────────────────────────────
    member_token    VARCHAR(64),
    org_id          VARCHAR(64),
    session_id      VARCHAR(64),
    role            VARCHAR(16),
    source_type     VARCHAR(32),

    -- ── Stage [1a] frontend → BullMQ enqueue ──────────────────
    s1_enqueue_started_at   TIMESTAMPTZ,
    s1_enqueue_finished_at  TIMESTAMPTZ,
    s1_enqueue_ms           INTEGER,

    -- ── Stage [1b] BullMQ queue wait (worker pickup) ──────────
    s1_queue_wait_started_at   TIMESTAMPTZ,   -- = enqueue_time (when job was enqueued)
    s1_queue_wait_finished_at  TIMESTAMPTZ,   -- = worker_pickup_at
    s1_queue_wait_ms           INTEGER,

    -- ── Stage [2] worker → FastAPI HTTP round-trip ────────────
    s2_started_at   TIMESTAMPTZ,              -- worker starts HTTP call
    s2_finished_at  TIMESTAMPTZ,              -- worker receives FastAPI response
    s2_ms           INTEGER,

    -- ── Stage [3] FastAPI LLM call ────────────────────────────
    s3_started_at   TIMESTAMPTZ,              -- fastapi_received_at
    s3_finished_at  TIMESTAMPTZ,              -- s3_llm_done_at
    s3_ms           INTEGER,                  -- s3_llm_ms

    -- ── Stage [4] FastAPI background DB save ──────────────────
    s4_started_at   TIMESTAMPTZ,              -- right after LLM done
    s4_finished_at  TIMESTAMPTZ,              -- s4_db_done_at
    s4_ms           INTEGER,                  -- s4_db_ms

    -- ── Stage [5] worker Redis publish ────────────────────────
    s5_started_at   TIMESTAMPTZ,              -- before pub.publish()
    s5_finished_at  TIMESTAMPTZ,              -- s5_published_at
    s5_ms           INTEGER,                  -- s5_publish_ms

    -- ── Stage [6] full end-to-end round-trip ──────────────────
    s6_started_at   TIMESTAMPTZ,              -- = enqueue_time
    s6_finished_at  TIMESTAMPTZ,              -- result_received_at
    s6_ms           INTEGER,                  -- s6_e2e_ms

    -- ── LLM result ────────────────────────────────────────────
    risk_tier       VARCHAR(16),
    risk_score      NUMERIC(4,3),
    risk_trend      VARCHAR(16),

    -- ── Run metadata ──────────────────────────────────────────
    fastapi_total_ms  INTEGER,                -- total FastAPI processing time
    is_complete       BOOLEAN  NOT NULL DEFAULT FALSE,  -- TRUE when stage [6] written
    has_error         BOOLEAN  NOT NULL DEFAULT FALSE,
    error_stage       VARCHAR(32),
    error_message     TEXT,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_pr_event_id     ON pipeline_runs(event_id);
CREATE INDEX idx_pr_created_at   ON pipeline_runs(created_at DESC);
CREATE INDEX idx_pr_member_token ON pipeline_runs(member_token) WHERE member_token IS NOT NULL;
CREATE INDEX idx_pr_risk_tier    ON pipeline_runs(risk_tier)    WHERE risk_tier IS NOT NULL;
CREATE INDEX idx_pr_is_complete  ON pipeline_runs(is_complete);
