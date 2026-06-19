-- Re-define log_phi_access trigger function to avoid compile-time/run-time field reference errors
-- by dynamically extracting member_id / memberId from the NEW/OLD record using to_jsonb().

CREATE OR REPLACE FUNCTION log_phi_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.phi_access_log (
    actor_id, actor_role, action, resource_table, resource_id,
    patient_id, accessed_at
  ) VALUES (
    COALESCE(current_setting('app.current_user_id', true), 'system'),
    COALESCE(current_setting('app.current_user_role', true), 'unknown'),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'CREATE'
      WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
      WHEN TG_OP = 'DELETE' THEN 'DELETE'
    END,
    TG_TABLE_NAME,
    COALESCE((to_jsonb(NEW) ->> 'id'), (to_jsonb(OLD) ->> 'id')),
    COALESCE(
      (to_jsonb(NEW) ->> 'member_id'),
      (to_jsonb(OLD) ->> 'member_id'),
      (to_jsonb(NEW) ->> 'memberId'),
      (to_jsonb(OLD) ->> 'memberId'),
      (to_jsonb(NEW) ->> 'patient_id'),
      (to_jsonb(OLD) ->> 'patient_id')
    ),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
