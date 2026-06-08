-- AlterTable
ALTER TABLE "Session" ADD COLUMN "livekitRoomName" TEXT;
ALTER TABLE "Session" ADD COLUMN "livekitStartedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "livekitEndedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Session_livekitRoomName_key" ON "Session"("livekitRoomName");
