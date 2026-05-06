-- V10: widen model_version from VARCHAR(16) to VARCHAR(64)
-- Needed to store full model slugs like 'google/gemini-2.0-flash-001'

ALTER TABLE inference_events
    ALTER COLUMN model_version TYPE VARCHAR(64);
