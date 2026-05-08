-- ============================================================
-- Dashboard Query: Full event detail with SHAP attributions
-- Used when a clinician clicks into a specific flagged event.
-- Replace :event_id with the API event_id string.
-- ============================================================

SELECT
    e.event_id,
    e.source_type,
    e.event_timestamp,
    e.risk_tier,
    e.risk_score,
    e.risk_trend,
    e.cultural_context,
    e.recommended_action,
    e.clinician_reviewed,
    e.review_deadline,
    e.model_version,

    -- Signals
    COALESCE(
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'code',       sig.signal_code,
                'label',      sig.signal_label,
                'confidence', sig.confidence,
                'dimension',  sig.dimension
            )
        ) FILTER (WHERE sig.id IS NOT NULL),
        '[]'
    ) AS active_signals,

    -- SHAP attributions ordered by weight
    COALESCE(
        JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
                'rank',   shap.rank,
                'span',   shap.span,
                'weight', shap.weight,
                'signal', shap.signal_code
            )
        ) FILTER (WHERE shap.id IS NOT NULL),
        '[]'
    ) AS shap_attributions,

    -- Review action if already reviewed
    JSON_BUILD_OBJECT(
        'review_id',       ra.review_id,
        'therapist_id',    ra.therapist_id,
        'action',          ra.action,
        'clinician_notes', ra.clinician_notes,
        'reviewed_at',     ra.reviewed_at
    ) AS review_action

FROM inference_events e
LEFT JOIN event_signals     sig  ON sig.event_id  = e.id
LEFT JOIN shap_attributions shap ON shap.event_id = e.id
LEFT JOIN review_actions    ra   ON ra.event_id   = e.id
WHERE e.event_id = :event_id
GROUP BY
    e.id, e.event_id, e.source_type, e.event_timestamp,
    e.risk_tier, e.risk_score, e.risk_trend, e.cultural_context,
    e.recommended_action, e.clinician_reviewed, e.review_deadline,
    e.model_version,
    ra.review_id, ra.therapist_id, ra.action,
    ra.clinician_notes, ra.reviewed_at;
