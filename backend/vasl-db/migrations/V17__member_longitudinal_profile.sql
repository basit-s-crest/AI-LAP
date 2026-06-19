-- ==========================================
-- PHASE 5: L3b LONGITUDINAL PROFILE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.member_longitudinal_profile (
  id                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  member_id               TEXT NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
  coach_id                TEXT NOT NULL REFERENCES public."Coach"(id) ON DELETE CASCADE,
  presenting_conditions   TEXT[] NOT NULL DEFAULT '{}',
  core_wounds             TEXT[] NOT NULL DEFAULT '{}',
  recurring_themes        TEXT[] NOT NULL DEFAULT '{}',
  progress_markers        TEXT[] NOT NULL DEFAULT '{}',
  risk_flags              TEXT[] NOT NULL DEFAULT '{}',
  unresolved_threads      TEXT[] NOT NULL DEFAULT '{}',
  overall_progress_score  FLOAT8 NOT NULL DEFAULT 50.0,
  current_risk_tier       TEXT NOT NULL DEFAULT 'low',
  risk_trend              TEXT,
  total_sessions          INTEGER NOT NULL DEFAULT 0,
  last_session_date       DATE,
  last_updated            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT member_longitudinal_profile_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.member_longitudinal_profile ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY coach_reads_assigned_profile ON public.member_longitudinal_profile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."CoachMember" cm
      WHERE cm."userId" = member_longitudinal_profile.member_id
        AND cm."coachId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY member_reads_own_profile ON public.member_longitudinal_profile
  FOR SELECT USING (member_id = (SELECT auth.uid()::text));

-- System management/bypass
CREATE POLICY system_manages_profile ON public.member_longitudinal_profile
  FOR ALL USING (true);

-- No hard delete
CREATE POLICY no_hard_delete_profile ON public.member_longitudinal_profile
  FOR DELETE USING (false);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_longitudinal_profile ON public.member_longitudinal_profile;
CREATE TRIGGER audit_longitudinal_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.member_longitudinal_profile
  FOR EACH ROW EXECUTE FUNCTION log_phi_access();
