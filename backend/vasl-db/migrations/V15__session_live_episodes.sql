-- ==========================================
-- PHASE 3: L2 SESSION LIVE EPISODES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.session_live_episodes (
  id            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  session_id    TEXT NOT NULL REFERENCES public."Session"(id) ON DELETE CASCADE,
  member_id     TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  episode_index INTEGER NOT NULL,        -- Chronological: 0, 1, 2...
  summary       TEXT NOT NULL,            -- Compressed summary (unencrypted per decision)
  sentiment     TEXT NOT NULL,            -- CRISIS | HIGH | MEDIUM | LOW
  themes        TEXT[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT session_live_episodes_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS session_live_episodes_session_idx
  ON public.session_live_episodes (session_id, episode_index ASC);

-- Enable RLS
ALTER TABLE public.session_live_episodes ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY coach_reads_assigned_episodes ON public.session_live_episodes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."CoachMember" cm
      WHERE cm."userId" = session_live_episodes.member_id
        AND cm."coachId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY member_reads_own_episodes ON public.session_live_episodes
  FOR SELECT USING (member_id = (SELECT auth.uid()::text));

CREATE POLICY system_manages_episodes ON public.session_live_episodes
  FOR ALL USING (true);

-- No hard delete
CREATE POLICY no_hard_delete_episodes ON public.session_live_episodes
  FOR DELETE USING (false);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_session_live_episodes ON public.session_live_episodes;
CREATE TRIGGER audit_session_live_episodes
  AFTER INSERT OR UPDATE OR DELETE ON public.session_live_episodes
  FOR EACH ROW EXECUTE FUNCTION log_phi_access();
