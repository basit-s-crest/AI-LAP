"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateReport = exports.getAvailableWeeks = exports.getWeeklyReport = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// Helper to get Monday of a given week
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
// Helper to get Sunday of a given week
function getSunday(date) {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
}
// Generate weekly report data
async function generateReportData(organizationId, weekStart, weekEnd) {
    // First, get all member IDs for this organization
    const orgMembers = await prisma_1.default.user.findMany({
        where: { organizationId, role: "member" },
        select: { id: true },
    });
    const memberIds = orgMembers.map((m) => m.id);
    const [totalMembers, activeMembers, newMembers, sessionsCompleted, avgSessionRating, crisisAlerts, moodEntries, groupPosts, groupMembers, coachMessages, phqAssessments, gadAssessments,] = await Promise.all([
        // Total members
        Promise.resolve(memberIds.length),
        // Active members (had activity in the week)
        prisma_1.default.user.count({
            where: {
                id: { in: memberIds },
                lastActiveAt: { gte: weekStart, lte: weekEnd },
            },
        }),
        // New members joined this week
        prisma_1.default.user.count({
            where: {
                id: { in: memberIds },
                createdAt: { gte: weekStart, lte: weekEnd },
            },
        }),
        // Sessions completed (for organization members)
        prisma_1.default.session.count({
            where: {
                memberId: { in: memberIds },
                scheduledAt: { gte: weekStart, lte: weekEnd },
                status: "completed",
            },
        }),
        // Average session rating (mock for now)
        Promise.resolve(null),
        // Crisis alerts (flagged posts as proxy) - filter by organization members
        prisma_1.default.peerGroupPost.count({
            where: {
                memberId: { in: memberIds },
                createdAt: { gte: weekStart, lte: weekEnd },
                isFlagged: true,
            },
        }),
        // Mood entries - filter by organization members
        prisma_1.default.mood.count({
            where: {
                userId: { in: memberIds },
                date: { gte: weekStart, lte: weekEnd },
            },
        }),
        // Group posts - filter by organization members
        prisma_1.default.peerGroupPost.count({
            where: {
                memberId: { in: memberIds },
                createdAt: { gte: weekStart, lte: weekEnd },
            },
        }),
        // Group memberships - filter by organization members
        prisma_1.default.groupMembership.count({
            where: {
                memberId: { in: memberIds },
                isActive: true,
            },
        }),
        // Coach messages - filter by organization members
        prisma_1.default.coachMessage.count({
            where: {
                userId: { in: memberIds },
                createdAt: { gte: weekStart, lte: weekEnd },
            },
        }),
        // PHQ assessments - filter by organization members
        prisma_1.default.onboardingAssessment.findMany({
            where: {
                userId: { in: memberIds },
                createdAt: { lte: weekEnd },
            },
            select: { phqScore: true },
        }),
        // GAD assessments - filter by organization members
        prisma_1.default.onboardingAssessment.findMany({
            where: {
                userId: { in: memberIds },
                createdAt: { lte: weekEnd },
            },
            select: { gadScore: true },
        }),
    ]);
    // Calculate averages
    const avgPhq = phqAssessments.length > 0
        ? Math.round(phqAssessments.reduce((sum, a) => sum + a.phqScore, 0) / phqAssessments.length)
        : null;
    const avgGad = gadAssessments.length > 0
        ? Math.round(gadAssessments.reduce((sum, a) => sum + a.gadScore, 0) / gadAssessments.length)
        : null;
    // Mood distribution - filter by organization members
    const moodData = await prisma_1.default.mood.groupBy({
        by: ["mood"],
        where: {
            userId: { in: memberIds },
            date: { gte: weekStart, lte: weekEnd },
        },
        _count: { _all: true },
    });
    const moodDistribution = {
        GREAT: moodData.find((m) => m.mood === "GREAT")?._count._all || 0,
        GOOD: moodData.find((m) => m.mood === "GOOD")?._count._all || 0,
        OKAY: moodData.find((m) => m.mood === "OKAY")?._count._all || 0,
        LOW: moodData.find((m) => m.mood === "LOW")?._count._all || 0,
        HARD: moodData.find((m) => m.mood === "HARD")?._count._all || 0,
    };
    // Get top active coaches - filter by organization members
    const topCoaches = await prisma_1.default.coachMessage.groupBy({
        by: ["coachId"],
        where: {
            userId: { in: memberIds },
            createdAt: { gte: weekStart, lte: weekEnd },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
    });
    const coachDetails = await Promise.all(topCoaches.map(async (tc) => {
        const coach = await prisma_1.default.coach.findUnique({
            where: { id: tc.coachId },
            select: { id: true, name: true, speciality: true },
        });
        return {
            id: coach?.id || tc.coachId,
            name: coach?.name || "Unknown",
            speciality: coach?.speciality || null,
            messageCount: tc._count.id,
        };
    }));
    // Engagement rate
    const engagementRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;
    return {
        weekStartDate: weekStart.toISOString(),
        weekEndDate: weekEnd.toISOString(),
        summary: {
            totalMembers,
            activeMembers,
            newMembers,
            engagementRate,
            sessionsCompleted,
            avgSessionRating,
            crisisAlerts,
        },
        mentalHealth: {
            avgPhqScore: avgPhq,
            avgGadScore: avgGad,
            moodEntries,
            moodDistribution,
        },
        community: {
            groupPosts,
            groupMembers,
            coachMessages,
        },
        coaches: {
            topActiveCoaches: coachDetails,
        },
    };
}
// Get or generate weekly report
const getWeeklyReport = async (req, res) => {
    try {
        // For organization role, orgId IS the organization's ID
        const orgId = req.user?.orgId || req.user?.id;
        if (!orgId) {
            return res.status(403).json({ message: "No organization associated" });
        }
        // Get week from query param or use current week
        const weekParam = req.query.week;
        const targetDate = weekParam ? new Date(weekParam) : new Date();
        const weekStart = getMonday(targetDate);
        const weekEnd = getSunday(targetDate);
        // Check if report already exists
        let report = await prisma_1.default.weeklyReport.findUnique({
            where: {
                organizationId_weekStartDate: {
                    organizationId: orgId,
                    weekStartDate: weekStart,
                },
            },
        });
        // If not, generate it
        if (!report) {
            const reportData = await generateReportData(orgId, weekStart, weekEnd);
            report = await prisma_1.default.weeklyReport.create({
                data: {
                    organizationId: orgId,
                    weekStartDate: weekStart,
                    weekEndDate: weekEnd,
                    reportData,
                },
            });
        }
        return res.status(200).json(report);
    }
    catch (error) {
        console.error("[getWeeklyReport]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getWeeklyReport = getWeeklyReport;
// Get list of available report weeks
const getAvailableWeeks = async (req, res) => {
    try {
        // For organization role, orgId IS the organization's ID
        const orgId = req.user?.orgId || req.user?.id;
        if (!orgId) {
            return res.status(403).json({ message: "No organization associated" });
        }
        const reports = await prisma_1.default.weeklyReport.findMany({
            where: { organizationId: orgId },
            orderBy: { weekStartDate: "desc" },
            select: {
                weekStartDate: true,
                weekEndDate: true,
                generatedAt: true,
            },
        });
        return res.status(200).json(reports);
    }
    catch (error) {
        console.error("[getAvailableWeeks]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getAvailableWeeks = getAvailableWeeks;
// Regenerate a specific week's report
const regenerateReport = async (req, res) => {
    try {
        // For organization role, orgId IS the organization's ID
        const orgId = req.user?.orgId || req.user?.id;
        if (!orgId) {
            return res.status(403).json({ message: "No organization associated" });
        }
        const weekParam = req.query.week;
        if (!weekParam) {
            return res.status(400).json({ message: "Week parameter required" });
        }
        const targetDate = new Date(weekParam);
        const weekStart = getMonday(targetDate);
        const weekEnd = getSunday(targetDate);
        const reportData = await generateReportData(orgId, weekStart, weekEnd);
        const report = await prisma_1.default.weeklyReport.upsert({
            where: {
                organizationId_weekStartDate: {
                    organizationId: orgId,
                    weekStartDate: weekStart,
                },
            },
            update: {
                reportData,
                generatedAt: new Date(),
            },
            create: {
                organizationId: orgId,
                weekStartDate: weekStart,
                weekEndDate: weekEnd,
                reportData,
            },
        });
        return res.status(200).json(report);
    }
    catch (error) {
        console.error("[regenerateReport]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.regenerateReport = regenerateReport;
