-- ============================================================
-- Dashboard Query: Admin org-level risk distribution
-- Returns aggregate counts by risk tier for an org.
-- No individual member data — matches spec Section 6.4.
-- Replace :org_id with the admin's org claim.
-- ============================================================

SELECT
    current_risk_tier,
    COUNT(*)                        AS member_count,
    ROUND(
        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1
    )                               AS percentage,
    SUM(pending_reviews)            AS total_pending_reviews,
    SUM(overdue_reviews)            AS total_overdue_reviews
FROM member_risk_snapshots
WHERE org_id = :org_id
GROUP BY current_risk_tier
ORDER BY
    CASE current_risk_tier
        WHEN 'crisis'   THEN 1
        WHEN 'high'     THEN 2
        WHEN 'moderate' THEN 3
        WHEN 'low'      THEN 4
    END;
