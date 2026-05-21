-- CreateTable
CREATE TABLE "OnboardingAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "age" TEXT,
    "identity" TEXT,
    "gender" TEXT,
    "orient" TEXT,
    "phqAnswers" INTEGER[],
    "phqScore" INTEGER NOT NULL,
    "gadAnswers" INTEGER[],
    "gadScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "brandTitle" TEXT NOT NULL DEFAULT 'Azadi Health',
    "brandTagline" TEXT NOT NULL DEFAULT 'Mental Wellness Platform',
    "logoUrl" TEXT,
    "loaderUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#4E8C58',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@azadihealth.com',
    "maxMembersPerCoach" INTEGER NOT NULL DEFAULT 20,
    "sessionDurationDefault" INTEGER NOT NULL DEFAULT 50,
    "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

--CreateIndex
CREATE UNIQUE INDEX "OnboardingAssessment_userId_key" ON "OnboardingAssessment"("userId");

-- AddForeignKey
ALTER TABLE "OnboardingAssessment" ADD CONSTRAINT "OnboardingAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
