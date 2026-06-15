-- CreateEnum
CREATE TYPE "SessionNoteStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "SessionNoteVersion" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "keyThemes" JSONB NOT NULL,
    "memberSentiment" TEXT NOT NULL,
    "coachObservations" TEXT NOT NULL,
    "riskFlag" BOOLEAN NOT NULL DEFAULT false,
    "riskNotes" TEXT NOT NULL DEFAULT '',
    "recommendedFollowUp" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionNoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionNoteVersion_noteId_idx" ON "SessionNoteVersion"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionNoteVersion_noteId_version_key" ON "SessionNoteVersion"("noteId", "version");

-- AlterTable (Add new columns first)
ALTER TABLE "SessionNote" ADD COLUMN "aiSessionNoteId" TEXT;
ALTER TABLE "SessionNote" ADD COLUMN "sessionId" TEXT;
ALTER TABLE "SessionNote" ADD COLUMN "status_new" "SessionNoteStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill legacy records into SessionNoteVersion (v1)
INSERT INTO "SessionNoteVersion" (
    "id",
    "noteId",
    "version",
    "summary",
    "keyThemes",
    "memberSentiment",
    "coachObservations",
    "riskFlag",
    "riskNotes",
    "recommendedFollowUp",
    "createdById",
    "createdAt"
)
SELECT
    'version_' || "id",
    "id",
    1,
    COALESCE("notes", ''),
    '[]'::jsonb,
    'Neutral',
    COALESCE("notes", ''),
    false,
    '',
    COALESCE("nextSessionGoal", ''),
    "coachId",
    "createdAt"
FROM "SessionNote";

-- Map old status varchar values to new Enum column
UPDATE "SessionNote"
SET "status_new" = CASE
    WHEN "status" = 'saved' THEN 'FINAL'::"SessionNoteStatus"
    ELSE 'DRAFT'::"SessionNoteStatus"
END;

-- Drop obsolete indexes
DROP INDEX "SessionNote_coachId_createdAt_idx";

-- Drop old columns
ALTER TABLE "SessionNote" DROP COLUMN "notes";
ALTER TABLE "SessionNote" DROP COLUMN "nextSessionGoal";
ALTER TABLE "SessionNote" DROP COLUMN "sessionType";
ALTER TABLE "SessionNote" DROP COLUMN "status";

-- Rename status_new to status
ALTER TABLE "SessionNote" RENAME COLUMN "status_new" TO "status";

-- Create unique index on sessionId
CREATE UNIQUE INDEX "SessionNote_sessionId_key" ON "SessionNote"("sessionId");

-- Create index on coachId and updatedAt DESC
CREATE INDEX "SessionNote_coachId_updatedAt_idx" ON "SessionNote"("coachId", "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNoteVersion" ADD CONSTRAINT "SessionNoteVersion_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "SessionNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
