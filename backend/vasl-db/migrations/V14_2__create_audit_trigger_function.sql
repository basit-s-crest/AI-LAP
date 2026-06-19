-- Trigger function to log writes to public.phi_access_log
-- Runs under SECURITY DEFINER to bypass normal row policies when inserting to the log table.

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
    COALESCE(NEW.id::text, OLD.id::text),
    COALESCE(NEW.member_id::text, OLD.member_id::text, NEW."memberId"::text, OLD."memberId"::text),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
