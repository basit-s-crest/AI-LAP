-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- Initialize lastActiveAt with createdAt for existing records
UPDATE "User" SET "lastActiveAt" = "createdAt" WHERE "lastActiveAt" IS NULL;
UPDATE "Coach" SET "lastActiveAt" = "createdAt" WHERE "lastActiveAt" IS NULL;
UPDATE "Organization" SET "lastActiveAt" = "createdAt" WHERE "lastActiveAt" IS NULL;
