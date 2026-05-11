-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerGroupPost" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "supportCount" INTEGER NOT NULL DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeerGroupPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMembership_memberId_idx" ON "GroupMembership"("memberId");

-- CreateIndex
CREATE INDEX "GroupMembership_groupId_idx" ON "GroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_memberId_groupId_key" ON "GroupMembership"("memberId", "groupId");

-- CreateIndex
CREATE INDEX "PeerGroupPost_groupId_createdAt_idx" ON "PeerGroupPost"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "PeerGroupPost_memberId_idx" ON "PeerGroupPost"("memberId");

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerGroupPost" ADD CONSTRAINT "PeerGroupPost_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommunityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerGroupPost" ADD CONSTRAINT "PeerGroupPost_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
