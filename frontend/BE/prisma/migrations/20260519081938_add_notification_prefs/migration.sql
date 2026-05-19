-- AlterTable
ALTER TABLE "Coach" ADD COLUMN     "notifyMessageAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyNewClientAssigned" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySessionReminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyDailyCheckin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyGroupActivity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifySessionReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyWeeklySummary" BOOLEAN NOT NULL DEFAULT true;
