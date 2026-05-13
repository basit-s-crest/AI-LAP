import dotenv from "dotenv";
dotenv.config();
import prisma from "./prisma";

async function migrate() {
  const groups = await prisma.communityGroup.findMany();

  for (const group of groups) {
    for (const memberId of group.memberIds) {
      const userExists = await prisma.user.findUnique({
        where: { id: memberId },
      });
      if (!userExists) continue;

      await prisma.groupMembership.upsert({
        where: { memberId_groupId: { memberId, groupId: group.id } },
        update: { isActive: true },
        create: { memberId, groupId: group.id, isActive: true },
      });
    }
    console.log(`Migrated ${group.memberIds.length} members for: ${group.name}`);
  }

  console.log("✅ Migration done");
  await prisma.$disconnect();
}

migrate().catch(console.error);
