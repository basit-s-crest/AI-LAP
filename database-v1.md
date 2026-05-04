I've read through the VASL ALAP spec carefully. Let me design a database schema focused specifically on your use case: **storing API inference responses and accumulating distress scores per member for dashboard display**.

## What you're storing

From the API responses, you get:
- Per-event inference results (risk tier, score, signals, SHAP)
- Member-level aggregated view (current risk tier, trend, multiple events)
- Clinician review actions

Here's the schema:

---

## Database Design

### Core Tables

```sql
-- ============================================================
-- 1. MEMBERS
-- Stores pseudonymized member tokens (no PII)
-- ============================================================
CREATE TABLE members (
    id              SERIAL PRIMARY KEY,
    member_token    VARCHAR(64) NOT NULL UNIQUE,  -- e.g. mbr_7c3a9f2e1b8d4c6a0e5f
    org_id          VARCHAR(64) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_org_id ON members(org_id);
CREATE INDEX idx_members_token  ON members(member_token);


-- ============================================================
-- 2. INFERENCE EVENTS
-- One row per API response event (the core table)
-- ============================================================
CREATE TABLE inference_events (
    id                  SERIAL PRIMARY KEY,
    event_id            VARCHAR(64) NOT NULL UNIQUE,   -- evt_01HX... from API
    member_id           INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    org_id              VARCHAR(64) NOT NULL,
    source_type         VARCHAR(32) NOT NULL,           -- peer-post | journal | chat | assessment
    event_timestamp     TIMESTAMPTZ NOT NULL,           -- when the original text was created
    ingested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Risk output
    risk_tier           VARCHAR(16) NOT NULL,           -- low | moderate | high | crisis
    risk_score          NUMERIC(4,3) NOT NULL,          -- 0.000 to 1.000
    risk_trend          VARCHAR(16),                    -- stable | increasing | decreasing

    -- Cultural context (array of strings like ["AAVE_CODE_SWITCH", "MINIMIZATION"])
    cultural_context    TEXT[],

    -- Recommended action from API
    recommended_action  VARCHAR(64),                    -- schedule_followup | immediate_crisis_protocol

    -- Review state
    clinician_reviewed  BOOLEAN NOT NULL DEFAULT FALSE,
    review_deadline     TIMESTAMPTZ,

    -- Model metadata
    model_version       VARCHAR(16),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_member_id       ON inference_events(member_id);
CREATE INDEX idx_events_org_id          ON inference_events(org_id);
CREATE INDEX idx_events_risk_tier       ON inference_events(risk_tier);
CREATE INDEX idx_events_event_timestamp ON inference_events(event_timestamp DESC);
CREATE INDEX idx_events_unreviewed      ON inference_events(clinician_reviewed, review_deadline)
    WHERE clinician_reviewed = FALSE;


-- ============================================================
-- 3. ACTIVE SIGNALS
-- The signals array inside each event (ISO-04, HOP-03, etc.)
-- ============================================================
CREATE TABLE event_signals (
    id              SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    signal_code     VARCHAR(16) NOT NULL,    -- e.g. ISO-04
    signal_label    VARCHAR(128),            -- e.g. "Social isolation — indirect"
    confidence      NUMERIC(4,3) NOT NULL,   -- 0.000 to 1.000
    dimension       VARCHAR(32)              -- hopelessness | isolation | self_harm | crisis | cultural
);

CREATE INDEX idx_signals_event_id    ON event_signals(event_id);
CREATE INDEX idx_signals_signal_code ON event_signals(signal_code);


-- ============================================================
-- 4. SHAP ATTRIBUTIONS
-- Token-level explanations per event
-- ============================================================
CREATE TABLE shap_attributions (
    id              SERIAL PRIMARY KEY,
    event_id        INTEGER NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    span            VARCHAR(64) NOT NULL,    -- max 5 words per spec
    weight          NUMERIC(5,4) NOT NULL,   -- SHAP weight
    signal_code     VARCHAR(16),             -- which signal this span maps to
    rank            SMALLINT                 -- 1 = highest weight
);

CREATE INDEX idx_shap_event_id ON shap_attributions(event_id);


-- ============================================================
-- 5. CLINICIAN REVIEW ACTIONS
-- Records every POST /v1/review/action response
-- ============================================================
CREATE TABLE review_actions (
    id              SERIAL PRIMARY KEY,
    review_id       VARCHAR(64) NOT NULL UNIQUE,   -- rev_01HX... from API
    event_id        INTEGER NOT NULL REFERENCES inference_events(id) ON DELETE CASCADE,
    member_id       INTEGER NOT NULL REFERENCES members(id),
    therapist_id    VARCHAR(64) NOT NULL,
    action          VARCHAR(64) NOT NULL,
    -- contacted_member | scheduled_session | escalated_to_crisis
    -- no_action_required | flagged_false_positive
    clinician_notes TEXT,
    reviewed_at     TIMESTAMPTZ NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_event_id   ON review_actions(event_id);
CREATE INDEX idx_reviews_member_id  ON review_actions(member_id);
CREATE INDEX idx_reviews_therapist  ON review_actions(therapist_id);


-- ============================================================
-- 6. MEMBER RISK SNAPSHOTS
-- Accumulated/aggregated score per member — updated after each
-- new inference event. This is what the dashboard reads fast.
-- ============================================================
CREATE TABLE member_risk_snapshots (
    id                      SERIAL PRIMARY KEY,
    member_id               INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE UNIQUE,
    org_id                  VARCHAR(64) NOT NULL,
    therapist_id            VARCHAR(64),

    -- Current state (from latest event)
    current_risk_tier       VARCHAR(16) NOT NULL DEFAULT 'low',
    current_risk_score      NUMERIC(4,3),
    risk_trend              VARCHAR(16),                -- stable | increasing | decreasing

    -- Accumulation stats
    total_events            INTEGER NOT NULL DEFAULT 0,
    high_crisis_event_count INTEGER NOT NULL DEFAULT 0,
    avg_risk_score_7d       NUMERIC(4,3),               -- rolling 7-day average
    avg_risk_score_30d      NUMERIC(4,3),               -- rolling 30-day average
    max_risk_score_30d      NUMERIC(4,3),               -- peak in last 30 days

    -- Most recent event reference
    latest_event_id         INTEGER REFERENCES inference_events(id),
    latest_event_at         TIMESTAMPTZ,

    -- Review tracking
    pending_reviews         INTEGER NOT NULL DEFAULT 0,
    overdue_reviews         INTEGER NOT NULL DEFAULT 0,

    last_calculated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_org_id    ON member_risk_snapshots(org_id);
CREATE INDEX idx_snapshots_risk_tier ON member_risk_snapshots(current_risk_tier);
CREATE INDEX idx_snapshots_therapist ON member_risk_snapshots(therapist_id);
```

---

### The Accumulation Logic

This is the key part — after each new inference event arrives, you update the snapshot:

```sql
-- Run this after inserting a new inference_events row
-- Replace :member_id with the actual member

INSERT INTO member_risk_snapshots (
    member_id,
    org_id,
    current_risk_tier,
    current_risk_score,
    risk_trend,
    total_events,
    high_crisis_event_count,
    avg_risk_score_7d,
    avg_risk_score_30d,
    max_risk_score_30d,
    latest_event_id,
    latest_event_at,
    pending_reviews,
    overdue_reviews,
    last_calculated_at,
    updated_at
)
SELECT
    m.id,
    m.org_id,

    -- Latest event values
    latest.risk_tier,
    latest.risk_score,
    latest.risk_trend,

    -- Counts
    COUNT(e.id)                                                         AS total_events,
    COUNT(e.id) FILTER (WHERE e.risk_tier IN ('high', 'crisis'))        AS high_crisis_event_count,

    -- Rolling averages
    AVG(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '7 days')   AS avg_risk_score_7d,
    AVG(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '30 days')  AS avg_risk_score_30d,
    MAX(e.risk_score) FILTER (WHERE e.event_timestamp >= NOW() - INTERVAL '30 days')  AS max_risk_score_30d,

    latest.id,
    latest.event_timestamp,

    -- Pending / overdue reviews
    COUNT(e.id) FILTER (WHERE e.clinician_reviewed = FALSE)             AS pending_reviews,
    COUNT(e.id) FILTER (
        WHERE e.clinician_reviewed = FALSE
        AND e.review_deadline < NOW()
    )                                                                   AS overdue_reviews,

    NOW(),
    NOW()

FROM members m
JOIN inference_events e ON e.member_id = m.id
-- Get the single latest event for current state
JOIN LATERAL (
    SELECT * FROM inference_events
    WHERE member_id = m.id
    ORDER BY event_timestamp DESC
    LIMIT 1
) latest ON TRUE
WHERE m.id = :member_id
GROUP BY m.id, m.org_id, latest.id, latest.risk_tier,
         latest.risk_score, latest.risk_trend, latest.event_timestamp

ON CONFLICT (member_id) DO UPDATE SET
    current_risk_tier       = EXCLUDED.current_risk_tier,
    current_risk_score      = EXCLUDED.current_risk_score,
    risk_trend              = EXCLUDED.risk_trend,
    total_events            = EXCLUDED.total_events,
    high_crisis_event_count = EXCLUDED.high_crisis_event_count,
    avg_risk_score_7d       = EXCLUDED.avg_risk_score_7d,
    avg_risk_score_30d      = EXCLUDED.avg_risk_score_30d,
    max_risk_score_30d      = EXCLUDED.max_risk_score_30d,
    latest_event_id         = EXCLUDED.latest_event_id,
    latest_event_at         = EXCLUDED.latest_event_at,
    pending_reviews         = EXCLUDED.pending_reviews,
    overdue_reviews         = EXCLUDED.overdue_reviews,
    last_calculated_at      = NOW(),
    updated_at              = NOW();
```

---

### Dashboard Queries

```sql
-- Therapist dashboard: all my members with their current risk state
SELECT
    m.member_token,
    s.current_risk_tier,
    s.current_risk_score,
    s.risk_trend,
    s.avg_risk_score_7d,
    s.avg_risk_score_30d,
    s.total_events,
    s.pending_reviews,
    s.overdue_reviews,
    s.latest_event_at
FROM member_risk_snapshots s
JOIN members m ON m.id = s.member_id
WHERE s.therapist_id = 'thr_dr_osei_001'
ORDER BY s.current_risk_score DESC;


-- Score history for a single member (the trend chart)
SELECT
    event_timestamp,
    risk_score,
    risk_tier,
    source_type
FROM inference_events
WHERE member_id = (SELECT id FROM members WHERE member_token = 'mbr_7c3a9f2e1b8d4c6a0e5f')
ORDER BY event_timestamp ASC;


-- Admin: org-level risk distribution
SELECT
    current_risk_tier,
    COUNT(*) AS member_count
FROM member_risk_snapshots
WHERE org_id = 'org_univ_maryland'
GROUP BY current_risk_tier;


-- Overdue reviews needing attention
SELECT
    m.member_token,
    e.event_id,
    e.risk_tier,
    e.risk_score,
    e.review_deadline
FROM inference_events e
JOIN members m ON m.id = e.member_id
WHERE e.clinician_reviewed = FALSE
  AND e.review_deadline < NOW()
  AND m.org_id = 'org_univ_maryland'
ORDER BY e.risk_score DESC;
```

---

## How it all fits together

```
API Response arrives
        │
        ▼
  inference_events  ──── event_signals
        │           ──── shap_attributions
        │
        ▼
  (upsert trigger)
        │
        ▼
  member_risk_snapshots   ◄── dashboard reads this (fast, pre-aggregated)
        │
        ▼
  review_actions          ◄── clinician submits review, marks event reviewed
```

The `member_risk_snapshots` table is the key design decision — instead of computing rolling averages on every dashboard load across potentially thousands of events, you maintain a pre-aggregated row per member and update it each time a new event comes in. Dashboard reads are then a simple indexed lookup.

A few things to note given the spec:
- `member_token` is stored but never the actual member identity — matches the pseudonymization requirement
- No raw text anywhere in the schema — you're only storing structured output
- The `shap_attributions.span` column stores the short text fragments (max 5 words per spec's threat model T2 mitigation)

Want me to scaffold this as actual migration files (Alembic, Flyway, or raw SQL), or add anything specific like a time-series extension for the score history?