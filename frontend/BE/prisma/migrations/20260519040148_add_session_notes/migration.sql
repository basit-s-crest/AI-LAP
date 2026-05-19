-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "nextSessionGoal" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionNote_coachId_idx" ON "SessionNote"("coachId");

-- CreateIndex
CREATE INDEX "SessionNote_memberId_idx" ON "SessionNote"("memberId");

-- CreateIndex
CREATE INDEX "SessionNote_coachId_createdAt_idx" ON "SessionNote"("coachId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
