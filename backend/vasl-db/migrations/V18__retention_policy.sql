-- ==========================================
-- PHASE 7: RETENTION POLICY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.retention_policy (
  id                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  resource_table          TEXT NOT NULL UNIQUE,
  retention_period_days   INTEGER NOT NULL,
  auto_delete_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT retention_policy_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.retention_policy ENABLE ROW LEVEL SECURITY;

-- System bypass/management
CREATE POLICY system_manages_retention ON public.retention_policy
  FOR ALL USING (true);

-- Insert default compliance retention configs (7 years / 2555 days)
INSERT INTO public.retention_policy (resource_table, retention_period_days) VALUES
  ('AiSessionNote', 2555),
  ('SessionNote', 2555),
  ('member_memory_events', 2555),
  ('session_live_episodes', 2555),
  ('phi_access_log', 2555)
ON CONFLICT (resource_table) DO NOTHING;
