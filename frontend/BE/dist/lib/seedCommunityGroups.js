"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("./prisma"));
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
    const existingCount = await prisma_1.default.communityGroup.count();
    if (existingCount > 0) {
        console.log(`Skipped: ${existingCount} community groups already exist.`);
        return;
    }
    for (const group of defaultGroups) {
        await prisma_1.default.communityGroup.create({
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
    await prisma_1.default.$disconnect();
});
