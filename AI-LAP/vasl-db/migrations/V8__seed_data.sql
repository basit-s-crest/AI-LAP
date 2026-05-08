-- ============================================================
-- Seed V8: Reference data
-- Orgs, therapists, groups, sessions — the lookup data that
-- member tokens and events reference.
-- ============================================================

-- ── Organisations (5 partner orgs) ────────────────────────────────────────────
-- These are referenced by org_id in every event.
-- Not a separate table — org_id is just a VARCHAR — but we document
-- the valid values here so seeds are consistent.

-- org_univ_maryland        University of Maryland Counseling Center
-- org_howard_university    Howard University Student Wellness
-- org_spelman_college      Spelman College Health Services
-- org_community_health_dc  DC Community Health Network
-- org_pride_center_la      LA Pride Youth Center


-- ── Therapists (10 licensed therapists across orgs) ───────────────────────────
-- Stored only as VARCHAR therapist_id in member_risk_snapshots.
-- thr_001  Dr. Amara Osei          org_univ_maryland
-- thr_002  Dr. Keisha Williams     org_univ_maryland
-- thr_003  Dr. Marcus Thompson     org_howard_university
-- thr_004  Dr. Priya Nair          org_howard_university
-- thr_005  Dr. Sofia Reyes         org_spelman_college
-- thr_006  Dr. James Park          org_spelman_college
-- thr_007  Dr. Aaliyah Johnson     org_community_health_dc
-- thr_008  Dr. Devon Carter        org_community_health_dc
-- thr_009  Dr. Zara Ahmed          org_pride_center_la
-- thr_010  Dr. River Nguyen        org_pride_center_la
