-- ============================================================
-- Migration V2: Inference events table
-- One row per inference result received from the ALAP API.
-- No raw text is ever stored — only structured output.
--
-- source_metadata columns store the source-specific IDs and
-- context that arrived with the original ingestion request:
--   peer-post  → group_id
--   journal    → mood_score
--   chat       → session_id, role
--   assessment → instrument, item_number
-- ============================================================

CREATE TABLE inference_events (
    id                  SERIAL       PRIMARY KEY,
    event_id            VARCHAR(64)  NOT NULL UNIQUE,  -- ingestion_id from gateway (ing_...)
    original_source_id  VARCHAR(64),                   -- post_id / entry_id / message_id / assessment_id
    member_id           INTEGER      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id              VARCHAR(64)  NOT NULL,
    source_type         VARCHAR(32)  NOT NULL,          -- peer-post | journal | chat | assessment
    event_timestamp     TIMESTAMPTZ  NOT NULL,          -- when the original content was created
    ingested_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- ── Source-specific metadata ──────────────────────────────────────────
    -- peer-post
    group_id            VARCHAR(64),                   -- peer group the post was made in

    -- journal
    mood_score          SMALLINT,                      -- 1–5 self-reported mood

    -- chat
    session_id          VARCHAR(64),                   -- coach session identifier
    role                VARCHAR(16),                   -- member | coach

    -- assessment
    instrument          VARCHAR(16),                   -- PHQ8 | GAD7 | ACES
    item_number         SMALLINT,                      -- which question in the instrument

    -- ── Risk classification output ────────────────────────────────────────
    risk_tier           VARCHAR(16)  NOT NULL,          -- low | moderate | high | crisis
    risk_score          NUMERIC(4,3) NOT NULL,          -- 0.000 – 1.000 continuous score
    risk_trend          VARCHAR(16),                    -- stable | increasing | decreasing

    -- Cultural context tags e.g. ["AAVE_CODE_SWITCH", "MINIMIZATION"]
    cultural_context    TEXT[],

    -- Recommended clinical action from API
    recommended_action  VARCHAR(64),                    -- schedule_followup | immediate_crisis_protocol | ...

    -- ── Clinician review state ────────────────────────────────────────────
    clinician_reviewed  BOOLEAN      NOT NULL DEFAULT FALSE,
    review_deadline     TIMESTAMPTZ,                    -- 24h from flag; 10min for crisis tier

    -- ── Model metadata ────────────────────────────────────────────────────
    model_version       VARCHAR(16),

    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookup by member
CREATE INDEX idx_events_member_id       ON inference_events(member_id);

-- Org-level queries (admin dashboard)
CREATE INDEX idx_events_org_id          ON inference_events(org_id);

-- Filter by risk tier (crisis alert queries)
CREATE INDEX idx_events_risk_tier       ON inference_events(risk_tier);

-- Time-series queries (score history chart) — DESC for latest-first
CREATE INDEX idx_events_event_timestamp ON inference_events(event_timestamp DESC);

-- Partial index: only unreviewed events — overdue review queries
CREATE INDEX idx_events_unreviewed      ON inference_events(clinician_reviewed, review_deadline)
    WHERE clinician_reviewed = FALSE;

-- Source-type filter (e.g. show only journal events for a member)
CREATE INDEX idx_events_source_type     ON inference_events(source_type);
