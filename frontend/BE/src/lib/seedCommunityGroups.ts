import dotenv from "dotenv";
dotenv.config();
import prisma from "./prisma";

const defaultGroups = [
  {
    name: "Anxiety Support Circle",
    emoji: "💙",
    description: "A safe space to share anxiety coping strategies.",
    color: "#4E8C58",
    tags: ["anxiety", "support"],
    mod: "SafeCircle Team",
  },
  {
    name: "Mindfulness & Meditation",
    emoji: "🧘",
    description: "Daily mindfulness check-ins and guided reflection.",
    color: "#5B8DEF",
    tags: ["mindfulness", "meditation"],
    mod: "SafeCircle Team",
  },
  {
    name: "Student Stress Relief",
    emoji: "📚",
    description: "For academic stress, burnout, and motivation support.",
    color: "#8A63D2",
    tags: ["students", "stress"],
    mod: "SafeCircle Team",
  },
  {
    name: "Sleep & Recovery",
    emoji: "🌙",
    description: "Improve sleep habits and share recovery routines.",
    color: "#2D9CDB",
    tags: ["sleep", "recovery"],
    mod: "SafeCircle Team",
  },
];

async function seedCommunityGroups() {
  const existingCount = await prisma.communityGroup.count();
  if (existingCount > 0) {
    console.log(`Skipped: ${existingCount} community groups already exist.`);
    return;
  }

  for (const group of defaultGroups) {
    await prisma.communityGroup.create({
      data: {
        ...group,
        status: "active",
        memberIds: [],
      },
    });
  }

  console.log(`Seeded ${defaultGroups.length} community groups.`);
}

seedCommunityGroups()
  .catch((error) => {
    console.error("Failed to seed community groups:", error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
