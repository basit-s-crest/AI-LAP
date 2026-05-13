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

  const hashedCoachPassword = await hashPassword("coach1234");

  const coachAmara = await prisma.coach.upsert({
    where: { email: "amara@azadihealth.com" },
    update: { name: "Dr. Amara Osei", speciality: "Trauma · CBT · Cultural Identity", bio: "Azadi Health Staff", avatar: "👩🏾‍⚕️", isActive: true },
    create: { email: "amara@azadihealth.com", name: "Dr. Amara Osei", password: hashedCoachPassword, speciality: "Trauma · CBT · Cultural Identity", bio: "Azadi Health Staff", avatar: "👩🏾‍⚕️", isActive: true },
  });
  console.log("Seeded coach: " + coachAmara.name);

  const coachMarcus = await prisma.coach.upsert({
    where: { email: "marcus@azadihealth.com" },
    update: { name: "Marcus Rivera", speciality: "Depression · Grief · Mindfulness", bio: "Azadi Health Staff", avatar: "🧑🏽‍⚕️", isActive: true },
    create: { email: "marcus@azadihealth.com", name: "Marcus Rivera", password: hashedCoachPassword, speciality: "Depression · Grief · Mindfulness", bio: "Azadi Health Staff", avatar: "🧑🏽‍⚕️", isActive: true },
  });
  console.log("Seeded coach: " + coachMarcus.name);

  const coachPriya = await prisma.coach.upsert({
    where: { email: "priya@azadihealth.com" },
    update: { name: "Priya Sharma", speciality: "Anxiety · ACT · South Asian Youth", bio: "University Partners", avatar: "👩🏽‍⚕️", isActive: true },
    create: { email: "priya@azadihealth.com", name: "Priya Sharma", password: hashedCoachPassword, speciality: "Anxiety · ACT · South Asian Youth", bio: "University Partners", avatar: "👩🏽‍⚕️", isActive: true },
  });
  console.log("Seeded coach: " + coachPriya.name);

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

  const adminEmail = "admin@azadihealth.com";
  const hashedAdminPassword = await hashPassword("admin1234");

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "superadmin", isVerified: true },
    create: {
      email: adminEmail,
      name: "Super Admin",
      password: hashedAdminPassword,
      role: "superadmin",
      isVerified: true,
    },
  });
  console.log("Seeded admin: admin@azadihealth.com");

  const hashedOrgPassword = await hashPassword("org1234");
  const organization = await prisma.organization.upsert({
    where: { primaryContactEmail: "org@stateuniversity.com" },
    update: {
      name: "State University System",
      type: "University",
      plan: "Enterprise",
      status: "active",
      primaryContactName: "Dr. Chen",
      primaryContactPassword: hashedOrgPassword,
    },
    create: {
      name: "State University System",
      type: "University",
      plan: "Enterprise",
      status: "active",
      primaryContactName: "Dr. Chen",
      primaryContactEmail: "org@stateuniversity.com",
      primaryContactPassword: hashedOrgPassword,
    },
  });
  console.log(`Seeded organization: ${organization.name}`);

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
