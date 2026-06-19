-- ==========================================
-- PHASE 4: L3a MEMBER MEMORY EVENTS
-- ==========================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.member_memory_events (
  id                  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  member_id           TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  session_id          TEXT NOT NULL REFERENCES public."Session"(id) ON DELETE CASCADE,
  coach_id            TEXT NOT NULL REFERENCES public."Coach"(id) ON DELETE CASCADE,
  session_number      INTEGER NOT NULL,
  session_date        DATE NOT NULL,
  category            TEXT NOT NULL, -- BREAKTHROUGH | DISCLOSURE | TURNING_POINT | RISK_SIGNAL
  narrative_encrypted BYTEA NOT NULL,
  raw_quote_encrypted BYTEA,
  emotional_valence   TEXT,          -- POSITIVE | NEGATIVE | AMBIVALENT
  significance_score  FLOAT8 NOT NULL,
  themes              TEXT[] NOT NULL DEFAULT '{}',
  embedding           vector(384) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ,
  CONSTRAINT member_memory_events_pkey PRIMARY KEY (id)
);

-- Index for vector search (ivfflat)
CREATE INDEX IF NOT EXISTS member_memory_events_embedding_idx
  ON public.member_memory_events USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Enable RLS
ALTER TABLE public.member_memory_events ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY coach_reads_assigned_memory_events ON public.member_memory_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."CoachMember" cm
      WHERE cm."userId" = member_memory_events.member_id
        AND cm."coachId" = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY member_reads_own_memory_events ON public.member_memory_events
  FOR SELECT USING (member_id = (SELECT auth.uid()::text));

-- System bypass/management
CREATE POLICY system_manages_memory_events ON public.member_memory_events
  FOR ALL USING (true);

-- No hard delete
CREATE POLICY no_hard_delete_memory_events ON public.member_memory_events
  FOR DELETE USING (false);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_member_memory_events ON public.member_memory_events;
CREATE TRIGGER audit_member_memory_events
  AFTER INSERT OR UPDATE OR DELETE ON public.member_memory_events
  FOR EACH ROW EXECUTE FUNCTION log_phi_access();
