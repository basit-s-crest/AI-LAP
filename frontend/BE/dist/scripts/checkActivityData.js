"use strict";
/**
 * Script to check activity data in database
 * Run with: npx ts-node src/scripts/checkActivityData.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../lib/prisma"));
async function checkActivityData() {
    console.log("🔍 Checking activity data in database...\n");
    try {
        // Check Users
        const totalUsers = await prisma_1.default.user.count({ where: { role: "member" } });
        const usersWithLastActive = await prisma_1.default.user.count({
            where: { role: "member", lastActiveAt: { not: null } }
        });
        console.log("👥 USERS (Members):");
        console.log(`   Total: ${totalUsers}`);
        console.log(`   With lastActiveAt: ${usersWithLastActive}`);
        console.log(`   Without lastActiveAt: ${totalUsers - usersWithLastActive}`);
        if (totalUsers > 0) {
            const recentUsers = await prisma_1.default.user.findMany({
                where: { role: "member" },
                select: { id: true, email: true, createdAt: true, lastActiveAt: true },
                take: 3,
                orderBy: { createdAt: "desc" }
            });
            console.log("\n   Sample users:");
            recentUsers.forEach(u => {
                console.log(`   - ${u.email}`);
                console.log(`     Created: ${u.createdAt.toISOString().split('T')[0]}`);
                console.log(`     LastActive: ${u.lastActiveAt ? u.lastActiveAt.toISOString().split('T')[0] : 'NULL'}`);
            });
        }
        // Check Coaches
        console.log("\n👨‍💼 COACHES:");
        const totalCoaches = await prisma_1.default.coach.count();
        const coachesWithLastActive = await prisma_1.default.coach.count({
            where: { lastActiveAt: { not: null } }
        });
        console.log(`   Total: ${totalCoaches}`);
        console.log(`   With lastActiveAt: ${coachesWithLastActive}`);
        console.log(`   Without lastActiveAt: ${totalCoaches - coachesWithLastActive}`);
        if (totalCoaches > 0) {
            const recentCoaches = await prisma_1.default.coach.findMany({
                select: { id: true, email: true, createdAt: true, lastActiveAt: true },
                take: 3,
                orderBy: { createdAt: "desc" }
            });
            console.log("\n   Sample coaches:");
            recentCoaches.forEach(c => {
                console.log(`   - ${c.email}`);
                console.log(`     Created: ${c.createdAt.toISOString().split('T')[0]}`);
                console.log(`     LastActive: ${c.lastActiveAt ? c.lastActiveAt.toISOString().split('T')[0] : 'NULL'}`);
            });
        }
        // Check Organizations
        console.log("\n🏢 ORGANIZATIONS:");
        const totalOrgs = await prisma_1.default.organization.count();
        const orgsWithLastActive = await prisma_1.default.organization.count({
            where: { lastActiveAt: { not: null } }
        });
        console.log(`   Total: ${totalOrgs}`);
        console.log(`   With lastActiveAt: ${orgsWithLastActive}`);
        console.log(`   Without lastActiveAt: ${totalOrgs - orgsWithLastActive}`);
        if (totalOrgs > 0) {
            const recentOrgs = await prisma_1.default.organization.findMany({
                select: { id: true, name: true, createdAt: true, lastActiveAt: true },
                take: 3,
                orderBy: { createdAt: "desc" }
            });
            console.log("\n   Sample organizations:");
            recentOrgs.forEach(o => {
                console.log(`   - ${o.name}`);
                console.log(`     Created: ${o.createdAt.toISOString().split('T')[0]}`);
                console.log(`     LastActive: ${o.lastActiveAt ? o.lastActiveAt.toISOString().split('T')[0] : 'NULL'}`);
            });
        }
        // Check date range
        console.log("\n📅 DATE RANGE CHECK:");
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        console.log(`   Looking for data from: ${thirtyDaysAgo.toISOString().split('T')[0]} to today`);
        const usersInRange = await prisma_1.default.user.count({
            where: {
                role: "member",
                OR: [
                    { lastActiveAt: { gte: thirtyDaysAgo } },
                    { lastActiveAt: null, createdAt: { gte: thirtyDaysAgo } }
                ]
            }
        });
        const coachesInRange = await prisma_1.default.coach.count({
            where: {
                OR: [
                    { lastActiveAt: { gte: thirtyDaysAgo } },
                    { lastActiveAt: null, createdAt: { gte: thirtyDaysAgo } }
                ]
            }
        });
        const orgsInRange = await prisma_1.default.organization.count({
            where: {
                OR: [
                    { lastActiveAt: { gte: thirtyDaysAgo } },
                    { lastActiveAt: null, createdAt: { gte: thirtyDaysAgo } }
                ]
            }
        });
        console.log(`   Users in last 30 days: ${usersInRange}`);
        console.log(`   Coaches in last 30 days: ${coachesInRange}`);
        console.log(`   Organizations in last 30 days: ${orgsInRange}`);
        if (usersInRange === 0 && coachesInRange === 0 && orgsInRange === 0) {
            console.log("\n⚠️  NO DATA IN LAST 30 DAYS!");
            console.log("   This is why the chart shows 'No activity data available'");
            console.log("\n💡 Solutions:");
            console.log("   1. Try 90D button to see older data");
            console.log("   2. Run: npx ts-node src/scripts/seedActivityData.ts");
            console.log("   3. Create some test accounts");
        }
        else {
            console.log("\n✅ Data exists! If chart is empty, check:");
            console.log("   1. Backend server is running");
            console.log("   2. Prisma client is regenerated (npx prisma generate)");
            console.log("   3. Browser console for errors");
        }
    }
    catch (error) {
        console.error("\n❌ Error:", error);
        if (error instanceof Error && error.message.includes("lastActiveAt")) {
            console.log("\n💡 FIX: Run these commands:");
            console.log("   cd d:\\AI-LAP\\frontend\\BE");
            console.log("   npx prisma migrate deploy");
            console.log("   npx prisma generate");
        }
    }
}
checkActivityData()
    .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.default.$disconnect();
});
