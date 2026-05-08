-- ============================================================
-- Migration V6: Member risk snapshots table
-- Pre-aggregated risk state per member — updated after every
-- new inference event. Dashboard reads hit this table directly
-- (O(1) lookup) instead of aggregating across all events on
-- every request.
-- ============================================================

CREATE TABLE member_risk_snapshots (
    id                      SERIAL        PRIMARY KEY,
    member_id               INTEGER       NOT NULL REFERENCES members(id) ON DELETE CASCADE UNIQUE,
    org_id                  VARCHAR(64)   NOT NULL,
    therapist_id            VARCHAR(64),              -- assigned therapist

    -- Current state — from the latest inference event
    current_risk_tier       VARCHAR(16)   NOT NULL DEFAULT 'low',
    current_risk_score      NUMERIC(4,3),
    risk_trend              VARCHAR(16),              -- stable | increasing | decreasing

    -- Accumulated statistics
    total_events            INTEGER       NOT NULL DEFAULT 0,
    high_crisis_event_count INTEGER       NOT NULL DEFAULT 0,  -- lifetime count of high/crisis events
    avg_risk_score_7d       NUMERIC(4,3),             -- rolling 7-day average score
    avg_risk_score_30d      NUMERIC(4,3),             -- rolling 30-day average score
    max_risk_score_30d      NUMERIC(4,3),             -- peak score in last 30 days

    -- Pointer to the most recent event
    latest_event_id         INTEGER       REFERENCES inference_events(id),
    latest_event_at         TIMESTAMPTZ,

    -- Review SLA tracking
    pending_reviews         INTEGER       NOT NULL DEFAULT 0,  -- unreviewed flags
    overdue_reviews         INTEGER       NOT NULL DEFAULT 0,  -- past review_deadline

    last_calculated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Therapist dashboard: filter by therapist
CREATE INDEX idx_snapshots_therapist ON member_risk_snapshots(therapist_id);

-- Admin dashboard: filter by org
CREATE INDEX idx_snapshots_org_id    ON member_risk_snapshots(org_id);

-- Sort by risk tier (highest risk first)
CREATE INDEX idx_snapshots_risk_tier ON member_risk_snapshots(current_risk_tier);
