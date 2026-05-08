import dotenv from "dotenv";

import prisma from "./prisma";
import { hashPassword } from "../services/auth.service";

dotenv.config();

const runSeed = async (): Promise<void> => {
  const testUserEmail = "test@test.com";
  const coachEmail = "coach@test.com";

  const hashedPassword = await hashPassword("demo1234");

  const testUser = await prisma.user.upsert({
    where: { email: testUserEmail },
    update: {},
    create: {
      email: testUserEmail,
      name: "Test User",
      password: hashedPassword,
      role: "member",
      isVerified: true,
    },
  });

  const coachUser = await prisma.user.upsert({
    where: { email: coachEmail },
    update: {
      password: hashedPassword,
      role: "coach",
    },
    create: {
      email: coachEmail,
      name: "Coach User",
      password: hashedPassword,
      role: "coach",
      isVerified: true,
    },
  });

  const groupOne = await prisma.communityGroup.findFirst({
    where: { name: "Mindful Mornings" },
  });

  if (!groupOne) {
    await prisma.communityGroup.create({
      data: {
        name: "Mindful Mornings",
        emoji: "🌅",
        description: "Start your day with simple breathing and gratitude rituals.",
        color: "#4E8C58",
        tags: ["mindfulness", "routine"],
        mod: coachUser.name,
        memberIds: [testUser.id, coachUser.id],
      },
    });
  }

  const groupTwo = await prisma.communityGroup.findFirst({
    where: { name: "Stress Reset Circle" },
  });

  if (!groupTwo) {
    await prisma.communityGroup.create({
      data: {
        name: "Stress Reset Circle",
        emoji: "🧘",
        description: "A safe space for stress release, reflection, and support.",
        color: "#6C63FF",
        tags: ["stress", "support"],
        mod: coachUser.name,
        memberIds: [coachUser.id],
      },
    });
  }

  const existingMessages = await prisma.message.count({
    where: {
      OR: [
        { senderId: testUser.id, receiverId: coachUser.id },
        { senderId: coachUser.id, receiverId: testUser.id },
      ],
    },
  });

  if (existingMessages === 0) {
    await prisma.message.createMany({
      data: [
        {
          senderId: testUser.id,
          receiverId: coachUser.id,
          content: "Hi coach, I am feeling anxious today.",
        },
        {
          senderId: coachUser.id,
          receiverId: testUser.id,
          content: "Thanks for sharing. Want to try a 2-minute breathing reset?",
        },
        {
          senderId: testUser.id,
          receiverId: coachUser.id,
          content: "Yes, that sounds great. Please guide me.",
        },
      ],
    });
  }

  console.log("Seed completed successfully");
};

runSeed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
