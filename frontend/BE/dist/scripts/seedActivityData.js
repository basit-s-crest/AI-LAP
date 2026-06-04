"use strict";
/**
 * Script to seed test data for admin activity chart
 * Run with: npx ts-node src/scripts/seedActivityData.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_service_1 = require("../services/auth.service");
async function seedActivityData() {
    console.log("🌱 Seeding activity data for chart testing...");
    const password = await (0, auth_service_1.hashPassword)("Test123!");
    // Create users over the last 30 days
    const userPromises = [];
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        // Create 1-3 users per day
        const usersPerDay = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < usersPerDay; j++) {
            userPromises.push(prisma_1.default.user.create({
                data: {
                    email: `testuser${i}_${j}_${Date.now()}@example.com`,
                    name: `Test User ${i}-${j}`,
                    password,
                    role: "member",
                    isVerified: true,
                    createdAt: date,
                },
            }));
        }
    }
    // Create coaches over the last 30 days
    const coachPromises = [];
    for (let i = 0; i < 15; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 2)); // Every 2 days
        coachPromises.push(prisma_1.default.coach.create({
            data: {
                email: `testcoach${i}_${Date.now()}@example.com`,
                name: `Test Coach ${i}`,
                password,
                isActive: true,
                createdAt: date,
            },
        }));
    }
    // Create organizations over the last 30 days
    const orgPromises = [];
    for (let i = 0; i < 10; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (i * 3)); // Every 3 days
        orgPromises.push(prisma_1.default.organization.create({
            data: {
                name: `Test Organization ${i}`,
                type: "University",
                plan: "Starter",
                primaryContactEmail: `testorg${i}_${Date.now()}@example.com`,
                primaryContactPassword: password,
                createdAt: date,
            },
        }));
    }
    await Promise.all([...userPromises, ...coachPromises, ...orgPromises]);
    console.log("✅ Activity data seeded successfully!");
    console.log(`   - Created ${userPromises.length} users`);
    console.log(`   - Created ${coachPromises.length} coaches`);
    console.log(`   - Created ${orgPromises.length} organizations`);
}
seedActivityData()
    .catch((error) => {
    console.error("❌ Error seeding activity data:", error);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
