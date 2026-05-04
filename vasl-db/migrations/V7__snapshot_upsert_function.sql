-- ============================================================
-- Migration V7: Snapshot upsert function
-- Called after every INSERT into inference_events to keep the
-- member_risk_snapshots table current. Recalculates all rolling
-- stats for the given member in a single query.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_member_risk_snapshot(p_member_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
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

        -- Pull current state from the latest event
        latest.risk_tier,
        latest.risk_score,
        latest.risk_trend,

        -- Lifetime counts
        COUNT(e.id),
        COUNT(e.id) FILTER (WHERE e.risk_tier IN ('high', 'crisis')),

        -- Rolling averages
        AVG(e.risk_score) FILTER (
            WHERE e.event_timestamp >= NOW() - INTERVAL '7 days'
        ),
        AVG(e.risk_score) FILTER (
            WHERE e.event_timestamp >= NOW() - INTERVAL '30 days'
        ),
        MAX(e.risk_score) FILTER (
            WHERE e.event_timestamp >= NOW() - INTERVAL '30 days'
        ),

        -- Latest event pointer
        latest.id,
        latest.event_timestamp,

        -- Review SLA counts
        COUNT(e.id) FILTER (
            WHERE e.clinician_reviewed = FALSE
        ),
        COUNT(e.id) FILTER (
            WHERE e.clinician_reviewed = FALSE
            AND   e.review_deadline < NOW()
        ),

        NOW(),
        NOW()

    FROM members m
    JOIN inference_events e ON e.member_id = m.id
    -- LATERAL join to get the single most recent event efficiently
    JOIN LATERAL (
        SELECT *
        FROM   inference_events
        WHERE  member_id = m.id
        ORDER  BY event_timestamp DESC
        LIMIT  1
    ) latest ON TRUE
    WHERE m.id = p_member_id
    GROUP BY
        m.id, m.org_id,
        latest.id, latest.risk_tier, latest.risk_score,
        latest.risk_trend, latest.event_timestamp

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
END;
$$;


-- ============================================================
-- Trigger: auto-call snapshot upsert after every new event
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_snapshot_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM upsert_member_risk_snapshot(NEW.member_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inference_event_snapshot
    AFTER INSERT ON inference_events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_snapshot_upsert();
