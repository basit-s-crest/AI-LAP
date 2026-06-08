-- First, delete duplicate assessments keeping only the most recent one per user
DELETE FROM "OnboardingAssessment" a
USING "OnboardingAssessment" b
WHERE a."userId" = b."userId"
  AND a."createdAt" < b."createdAt";

-- Add unique constraint to userId
CREATE UNIQUE INDEX "OnboardingAssessment_userId_key" ON "OnboardingAssessment"("userId");

-- CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingAssessment_userId_key" ON "OnboardingAssessment"("userId");
