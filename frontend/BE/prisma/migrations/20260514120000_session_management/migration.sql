-- Recover missing migration file + align Session with schema (scheduledAt, optional fields).
-- Safe if "date" column still exists; skips rename if "scheduledAt" already present.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'scheduledAt'
  ) THEN
    ALTER TABLE "Session" RENAME COLUMN "date" TO "scheduledAt";
  END IF;
END $$;

ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "rescheduleRequest" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "rescheduleBy" TEXT;

-- Ensure CoachAvailability upsert target exists (unique on coachId)
CREATE UNIQUE INDEX IF NOT EXISTS "CoachAvailability_coachId_key" ON "CoachAvailability"("coachId");
