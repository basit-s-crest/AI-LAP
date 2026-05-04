-- ============================================================
-- Migration V2: Inference events table
-- One row per inference result received from the ALAP API.
-- No raw text is ever stored — only structured output.
-- ============================================================

CREATE TABLE inference_events (
    id                  SERIAL       PRIMARY KEY,
    event_id            VARCHAR(64)  NOT NULL UNIQUE,  -- evt_01HX... from API (UUID v7)
    member_id           INTEGER      NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id              VARCHAR(64)  NOT NULL,
    source_type         VARCHAR(32)  NOT NULL,          -- peer-post | journal | chat | assessment
    event_timestamp     TIMESTAMPTZ  NOT NULL,          -- when the original content was created
    ingested_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    -- Risk classification output
    risk_tier           VARCHAR(16)  NOT NULL,          -- low | moderate | high | crisis
    risk_score          NUMERIC(4,3) NOT NULL,          -- 0.000 – 1.000 continuous score
    risk_trend          VARCHAR(16),                    -- stable | increasing | decreasing

    -- Cultural context tags e.g. ["AAVE_CODE_SWITCH", "MINIMIZATION"]
    cultural_context    TEXT[],

    -- Recommended clinical action from API
    recommended_action  VARCHAR(64),                    -- schedule_followup | immediate_crisis_protocol | ...

    -- Clinician review state
    clinician_reviewed  BOOLEAN      NOT NULL DEFAULT FALSE,
    review_deadline     TIMESTAMPTZ,                    -- 24h from flag; 10min for crisis tier

    -- Model metadata
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
