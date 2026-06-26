-- ==========================================
-- PHASE 1: CONSENT & AUDIT SCHEMA
-- ==========================================

CREATE TABLE IF NOT EXISTS public.patient_consent (
  id              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  patient_id      TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  consent_type    TEXT NOT NULL, -- 'recording' | 'ai_analysis'
  consent_version TEXT NOT NULL,
  granted         BOOLEAN NOT NULL DEFAULT false,
  granted_at      TIMESTAMPTZ DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  ip_address      INET,
  document_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_consent_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS patient_consent_active_idx
  ON public.patient_consent (patient_id, consent_type, revoked_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.phi_access_log (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id        TEXT NOT NULL,
  actor_role      TEXT NOT NULL,        -- 'member' | 'coach' | 'admin' | 'system'
  action          TEXT NOT NULL,        -- 'CREATE' | 'UPDATE' | 'DELETE' | 'READ'
  resource_table  TEXT NOT NULL,
  resource_id     TEXT NOT NULL,
  patient_id      TEXT,
  ip_address      INET,
  user_agent      TEXT,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Make audit log append-only
REVOKE UPDATE, DELETE ON public.phi_access_log FROM public;

CREATE INDEX IF NOT EXISTS phi_access_log_patient_idx ON public.phi_access_log (patient_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS phi_access_log_actor_idx ON public.phi_access_log (actor_id, accessed_at DESC);

-- Enable RLS on these tables
ALTER TABLE public.patient_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

-- Consent Policies
DROP POLICY IF EXISTS coach_reads_assigned_consent ON public.patient_consent;
CREATE POLICY coach_reads_assigned_consent ON public.patient_consent
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."CoachMember" cm
      where cm."userId" = patient_consent.patient_id
      and cm."coachId" = (SELECT auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS member_reads_own_consent ON public.patient_consent;
CREATE POLICY member_reads_own_consent ON public.patient_consent
  FOR SELECT USING (patient_id = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS system_manages_consent ON public.patient_consent;
CREATE POLICY system_manages_consent ON public.patient_consent
  FOR ALL USING (true); -- fallback for server-side operations using direct client/system roles

-- Access Log Policies
DROP POLICY IF EXISTS admin_reads_all_logs ON public.phi_access_log;
CREATE POLICY admin_reads_all_logs ON public.phi_access_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."User" u
      where u.id = (SELECT auth.uid()::text)
      and u.role = 'admin'
    )
  );

DROP POLICY IF EXISTS actor_reads_own_logs ON public.phi_access_log;
CREATE POLICY actor_reads_own_logs ON public.phi_access_log
  FOR SELECT USING (actor_id = (SELECT auth.uid()::text));

DROP POLICY IF EXISTS system_inserts_logs ON public.phi_access_log;
CREATE POLICY system_inserts_logs ON public.phi_access_log
  FOR INSERT WITH CHECK (true);

-- Encryption/Decryption Helpers using pgsodium
CREATE OR REPLACE FUNCTION encrypt_phi_field(plaintext text, key_id uuid)
RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN pgsodium.crypto_aead_det_encrypt(
    convert_to(plaintext, 'utf8'),
    convert_to(key_id::text, 'utf8'),
    key_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_phi_field(ciphertext bytea, key_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN convert_from(
    pgsodium.crypto_aead_det_decrypt(
      ciphertext,
      convert_to(key_id::text, 'utf8'),
      key_id
    ),
    'utf8'
  );
END;
$$;
