-- ============================================================
-- Migration V5: Clinician review actions table
-- Records every POST /v1/review/action API response.
-- This is the human-in-the-loop acknowledgment — required within
-- 24h of a high-risk flag (10 min for crisis tier).
-- ============================================================

CREATE TABLE review_actions (
    id              SERIAL       PRIMARY KEY,
    review_id       VARCHAR(64)  NOT NULL UNIQUE,  -- rev_01HX... from API
    event_id        INTEGER      NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    member_id       INTEGER      NOT NULL REFERENCES members(id),
    therapist_id    VARCHAR(64)  NOT NULL,

    -- Action taken by clinician
    action          VARCHAR(64)  NOT NULL,
    -- contacted_member | scheduled_session | escalated_to_crisis
    -- no_action_required | flagged_false_positive

    clinician_notes TEXT,                          -- free-text notes from clinician
    reviewed_at     TIMESTAMPTZ  NOT NULL,         -- when clinician performed the review
    recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_event_id   ON review_actions(event_id);
CREATE INDEX idx_reviews_member_id  ON review_actions(member_id);
CREATE INDEX idx_reviews_therapist  ON review_actions(therapist_id);
