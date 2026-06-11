-- CreateTable
CREATE TABLE "AiSessionNote" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "memberId" TEXT NOT NULL,
    "transcript" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "keyThemes" JSONB NOT NULL,
    "memberSentiment" TEXT NOT NULL,
    "coachObservations" TEXT NOT NULL,
    "riskFlag" BOOLEAN NOT NULL DEFAULT false,
    "riskNotes" TEXT NOT NULL DEFAULT '',
    "recommendedFollowUp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSessionNote_pkey" PRIMARY KEY ("id")
);
