-- ============================================================
-- Migration V4: SHAP attributions table
-- Stores token-level explanation spans from each inference result.
-- Spans are max 5 words (per spec threat model T2 — re-identification
-- mitigation). Clinicians use these to understand why a flag was raised.
-- ============================================================

CREATE TABLE shap_attributions (
    id              SERIAL        PRIMARY KEY,
    event_id        INTEGER       NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    span            VARCHAR(64)   NOT NULL,   -- short text fragment, max 5 words
    weight          NUMERIC(5,4)  NOT NULL,   -- SHAP attribution weight
    signal_code     VARCHAR(16),              -- which signal this span maps to (e.g. HOP-03)
    rank            SMALLINT                  -- 1 = highest contributing span
);

CREATE INDEX idx_shap_event_id ON shap_attributions(event_id);
