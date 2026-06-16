"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({
    log: ["error", "warn"],
});
async function main() {
    const orgId = "org_univ_maryland"; // Or any valid orgId from DB.
    console.log("Simulating concurrent queries...");
    try {
        const memberIds = await prisma.user.findMany({
            where: { organizationId: orgId },
            select: { id: true },
        }).then(rows => rows.map(r => r.id));
        console.log(`Found ${memberIds.length} members.`);
        // 12 concurrent queries
        const start = Date.now();
        await Promise.all([
            prisma.mood.findMany({
                where: { userId: { in: memberIds }, date: { gte: new Date() } },
                select: { userId: true },
                distinct: ["userId"],
            }),
            prisma.session.findMany({
                where: {
                    memberId: { in: memberIds },
                    scheduledAt: { gte: new Date() },
                    status: { not: "cancelled" },
                },
                select: { memberId: true },
                distinct: ["memberId"],
            }),
            prisma.session.count({
                where: {
                    memberId: { in: memberIds },
                    scheduledAt: { gte: new Date() },
                    status: { not: "cancelled" },
                },
            }),
            prisma.onboardingAssessment.findMany({
                where: { userId: { in: memberIds } },
                select: { phqScore: true, gadScore: true },
            }),
            prisma.mood.findMany({
                where: { userId: { in: memberIds }, date: { gte: new Date() } },
                select: { userId: true, date: true, mood: true },
            }),
            prisma.onboardingAssessment.count({
                where: { userId: { in: memberIds } },
            }),
            prisma.onboardingAssessment.count({
                where: { userId: { in: memberIds }, phqScore: { gt: 0 } },
            }),
            prisma.session.findMany({
                where: {
                    memberId: { in: memberIds },
                    status: { not: "cancelled" },
                },
                select: { memberId: true },
                distinct: ["memberId"],
            }),
            prisma.mood.groupBy({
                where: { userId: { in: memberIds } },
                by: ["mood"],
                _count: { _all: true },
            }),
            prisma.onboardingAssessment.findMany({
                where: { userId: { in: memberIds } },
                select: { phqScore: true, gadScore: true, userId: true },
            }),
            prisma.session.findMany({
                where: { memberId: { in: memberIds }, status: { not: "cancelled" } },
                select: { memberId: true },
            }),
            prisma.groupMembership.findMany({
                where: { memberId: { in: memberIds }, isActive: true },
                select: { memberId: true },
                distinct: ["memberId"],
            }),
        ]);
        console.log(`Success! All queries completed in ${Date.now() - start} ms`);
    }
    catch (err) {
        console.error("Failed concurrently:", err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
