-- ============================================================
-- Dashboard Query: Therapist view
-- Returns all members assigned to a therapist, sorted by
-- highest current risk score first.
-- Replace :therapist_id with the JWT claim value.
-- ============================================================

SELECT
    m.member_token,
    s.current_risk_tier,
    s.current_risk_score,
    s.risk_trend,
    s.avg_risk_score_7d,
    s.avg_risk_score_30d,
    s.total_events,
    s.high_crisis_event_count,
    s.pending_reviews,
    s.overdue_reviews,
    s.latest_event_at
FROM member_risk_snapshots s
JOIN members m ON m.id = s.member_id
WHERE s.therapist_id = :therapist_id
ORDER BY s.current_risk_score DESC;
