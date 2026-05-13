-- CreateTable: OrganizationCoach (many-to-many between Organization and Coach)
CREATE TABLE "OrganizationCoach" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "coachId"        TEXT NOT NULL,
    "assignedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationCoach_pkey" PRIMARY KEY ("id")
);

-- Unique pair
CREATE UNIQUE INDEX "OrganizationCoach_organizationId_coachId_key"
    ON "OrganizationCoach"("organizationId", "coachId");

-- Indexes
CREATE INDEX "OrganizationCoach_organizationId_idx" ON "OrganizationCoach"("organizationId");
CREATE INDEX "OrganizationCoach_coachId_idx"        ON "OrganizationCoach"("coachId");

-- Foreign keys
ALTER TABLE "OrganizationCoach"
    ADD CONSTRAINT "OrganizationCoach_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationCoach"
    ADD CONSTRAINT "OrganizationCoach_coachId_fkey"
    FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
