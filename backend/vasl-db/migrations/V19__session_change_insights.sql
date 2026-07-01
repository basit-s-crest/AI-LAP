-- ========================================================
-- V19: AI SESSION-TO-SESSION CHANGE DETECTION INSIGHTS
-- ========================================================

CREATE TABLE IF NOT EXISTS public."MemberChangeInsight" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
  "sessionNoteIdA" TEXT REFERENCES public."SessionNote"(id) ON DELETE SET NULL,
  "sessionNoteIdB" TEXT NOT NULL REFERENCES public."SessionNote"(id) ON DELETE CASCADE,
  "summary" TEXT NOT NULL,
  "improvements" JSONB,
  "concerns" JSONB,
  "goals" JSONB,
  "behavioralPatterns" JSONB,
  "safetyFlags" JSONB,
  "hasSafetyAlert" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberChangeInsight_pkey" PRIMARY KEY ("id")
);

-- Enable RLS
ALTER TABLE public."MemberChangeInsight" ENABLE ROW LEVEL SECURITY;

-- Select policies
DROP POLICY IF EXISTS coach_reads_assigned_insights ON public."MemberChangeInsight";
CREATE POLICY coach_reads_assigned_insights ON public."MemberChangeInsight"
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public."CoachMember" cm
      WHERE cm."userId" = "MemberChangeInsight"."memberId"
        AND cm."coachId" = (SELECT auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS member_reads_own_insights ON public."MemberChangeInsight";
CREATE POLICY member_reads_own_insights ON public."MemberChangeInsight"
  FOR SELECT USING ("memberId" = (SELECT auth.uid()::text));

-- System management/bypass
DROP POLICY IF EXISTS system_manages_insights ON public."MemberChangeInsight";
CREATE POLICY system_manages_insights ON public."MemberChangeInsight"
  FOR ALL USING (true);

-- No hard delete
DROP POLICY IF EXISTS no_hard_delete_insights ON public."MemberChangeInsight";
CREATE POLICY no_hard_delete_insights ON public."MemberChangeInsight"
  FOR DELETE USING (false);

-- Audit Trigger
DROP TRIGGER IF EXISTS audit_change_insights ON public."MemberChangeInsight";
CREATE TRIGGER audit_change_insights
  AFTER INSERT OR UPDATE OR DELETE ON public."MemberChangeInsight"
  FOR EACH ROW EXECUTE FUNCTION log_phi_access();
