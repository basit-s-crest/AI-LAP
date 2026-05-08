-- ============================================================
-- Dashboard Query: Score history for a single member
-- Used to render the risk score trend chart over time.
-- Replace :member_token with the value from the therapist's
-- member list.
-- ============================================================

SELECT
    e.event_id,
    e.event_timestamp,
    e.risk_score,
    e.risk_tier,
    e.source_type,
    e.recommended_action,
    e.clinician_reviewed,
    e.review_deadline,

    -- Aggregate signals for this event as a JSON array
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'code',       s.signal_code,
                'label',      s.signal_label,
                'confidence', s.confidence,
                'dimension',  s.dimension
            )
            ORDER BY s.confidence DESC
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'
    ) AS signals,

    -- Cultural context tags
    e.cultural_context

FROM inference_events e
LEFT JOIN event_signals s ON s.event_id = e.id
WHERE e.member_id = (
    SELECT id FROM members WHERE member_token = :member_token
)
GROUP BY
    e.id, e.event_id, e.event_timestamp, e.risk_score,
    e.risk_tier, e.source_type, e.recommended_action,
    e.clinician_reviewed, e.review_deadline, e.cultural_context
ORDER BY e.event_timestamp ASC;
