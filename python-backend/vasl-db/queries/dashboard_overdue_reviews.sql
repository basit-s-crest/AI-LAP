-- ============================================================
-- Dashboard Query: Overdue review queue
-- Returns all high/crisis flags that have passed their review
-- deadline without a clinician action.
-- Replace :org_id with the admin's org claim.
-- ============================================================

SELECT
    m.member_token,
    e.event_id,
    e.risk_tier,
    e.risk_score,
    e.source_type,
    e.event_timestamp,
    e.review_deadline,
    EXTRACT(EPOCH FROM (NOW() - e.review_deadline)) / 3600
        AS hours_overdue,

    -- Top signals for context
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'code',       s.signal_code,
                'label',      s.signal_label,
                'confidence', s.confidence
            )
            ORDER BY s.confidence DESC
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
    ) AS signals

FROM inference_events e
JOIN members m ON m.id = e.member_id
LEFT JOIN event_signals s ON s.event_id = e.id
WHERE e.clinician_reviewed = FALSE
  AND e.review_deadline    < NOW()
  AND m.org_id             = :org_id
GROUP BY
    m.member_token, e.id, e.event_id, e.risk_tier,
    e.risk_score, e.source_type, e.event_timestamp, e.review_deadline
ORDER BY e.risk_score DESC, e.review_deadline ASC;
