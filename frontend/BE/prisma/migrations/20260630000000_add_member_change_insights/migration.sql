-- CreateTable
CREATE TABLE "MemberChangeInsight" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sessionNoteIdA" TEXT,
    "sessionNoteIdB" TEXT NOT NULL,
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

-- CreateIndex
CREATE INDEX "MemberChangeInsight_memberId_idx" ON "MemberChangeInsight"("memberId");

-- CreateIndex
CREATE INDEX "MemberChangeInsight_createdAt_idx" ON "MemberChangeInsight"("createdAt" DESC);

-- AddForeignKey
ALTER TABLE "MemberChangeInsight" ADD CONSTRAINT "MemberChangeInsight_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberChangeInsight" ADD CONSTRAINT "MemberChangeInsight_sessionNoteIdA_fkey" FOREIGN KEY ("sessionNoteIdA") REFERENCES "SessionNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberChangeInsight" ADD CONSTRAINT "MemberChangeInsight_sessionNoteIdB_fkey" FOREIGN KEY ("sessionNoteIdB") REFERENCES "SessionNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
