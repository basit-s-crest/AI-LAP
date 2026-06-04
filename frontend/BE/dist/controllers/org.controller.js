"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrgSettings = exports.getOrgSettings = exports.getOrgOutcomes = exports.getOrgCoaches = exports.getOrgMembers = exports.getOrgOverview = exports.orgLogin = exports.orgRegister = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_service_1 = require("../services/auth.service");
const orgStats_service_1 = require("../services/orgStats.service");
const orgRegister = async (req, res) => {
    try {
        const { email, password, firstName, lastName, organizationName, organizationType } = req.body;
        if (!email || !password || !firstName || !organizationName) {
            return res.status(400).json({
                message: "Organization name, contact first name, email, and password are required",
            });
        }
        const existing = await prisma_1.default.organization.findUnique({
            where: { primaryContactEmail: email },
        });
        if (existing) {
            return res.status(409).json({ message: "Organization contact email already registered" });
        }
        const primaryContactPassword = await (0, auth_service_1.hashPassword)(password);
        const primaryContactName = [firstName, lastName].filter(Boolean).join(" ").trim();
        const organization = await prisma_1.default.organization.create({
            data: {
                name: organizationName,
                type: organizationType || "University",
                primaryContactName: primaryContactName || firstName,
                primaryContactEmail: email,
                primaryContactPassword,
            },
            select: {
                id: true,
                name: true,
                type: true,
                plan: true,
                status: true,
            },
        });
        return res.status(201).json({
            message: "Organization account created",
            organization,
        });
    }
    catch (error) {
        console.error("[orgRegister]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.orgRegister = orgRegister;
const orgLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const platform = await prisma_1.default.platformSettings.findUnique({
            where: { id: "platform" },
            select: { maintenanceMode: true },
        });
        if (platform?.maintenanceMode) {
            return res.status(503).json({ message: "Site is under maintenance" });
        }
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const organization = await prisma_1.default.organization.findUnique({
            where: { primaryContactEmail: email },
        });
        if (!organization) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const valid = await (0, auth_service_1.comparePassword)(password, organization.primaryContactPassword);
        if (!valid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = (0, auth_service_1.generateToken)(organization.id, "organization", organization.id);
        return res.status(200).json({
            token,
            organization: {
                id: organization.id,
                name: organization.name,
                type: organization.type,
                plan: organization.plan,
                status: organization.status,
            },
        });
    }
    catch (error) {
        console.error("[orgLogin]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.orgLogin = orgLogin;
const getOrgOverview = async (req, res) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId)
            return res.status(401).json({ message: "Unauthorized" });
        const organization = await prisma_1.default.organization.findUnique({ where: { id: orgId } });
        if (!organization)
            return res.status(404).json({ message: "Organization not found" });
        const [metrics, totalCoaches] = await Promise.all([
            (0, orgStats_service_1.buildOrgOverviewMetrics)(orgId),
            prisma_1.default.organizationCoach.count({ where: { organizationId: orgId } }),
        ]);
        return res.status(200).json({
            orgName: organization.name,
            type: organization.type,
            plan: organization.plan,
            status: organization.status,
            totalCoaches,
            ...metrics,
        });
    }
    catch (error) {
        console.error("[getOrgOverview]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrgOverview = getOrgOverview;
const getOrgMembers = async (req, res) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId)
            return res.status(401).json({ message: "Unauthorized" });
        const members = await prisma_1.default.user.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                isVerified: true,
                createdAt: true,
                lastActiveAt: true,
                avatar: true,
                role: true,
            },
        });
        // Get session counts for all members
        const memberIds = members.map((m) => m.id);
        const sessionCounts = await prisma_1.default.session.groupBy({
            by: ["memberId"],
            where: {
                memberId: { in: memberIds },
                status: { not: "cancelled" },
            },
            _count: {
                _all: true,
            },
        });
        const sessionCountMap = new Map(sessionCounts.map((s) => [s.memberId, s._count._all]));
        // Get average mood for each member
        const allMoods = await prisma_1.default.mood.findMany({
            where: { userId: { in: memberIds } },
            select: { userId: true, mood: true },
        });
        // Calculate mood scores: GREAT=5, GOOD=4, OKAY=3, LOW=2, HARD=1
        const moodScoresByUser = new Map();
        allMoods.forEach((m) => {
            const score = m.mood === "GREAT" ? 5 :
                m.mood === "GOOD" ? 4 :
                    m.mood === "OKAY" ? 3 :
                        m.mood === "LOW" ? 2 :
                            m.mood === "HARD" ? 1 : 0;
            const current = moodScoresByUser.get(m.userId) || { total: 0, count: 0 };
            moodScoresByUser.set(m.userId, {
                total: current.total + score,
                count: current.count + 1,
            });
        });
        return res.status(200).json(members.map((member) => {
            const moodData = moodScoresByUser.get(member.id);
            const avgMoodScore = moodData ? moodData.total / moodData.count : null;
            // Convert score back to emoji
            const avgMood = avgMoodScore
                ? avgMoodScore >= 4.5 ? "😊" :
                    avgMoodScore >= 3.5 ? "🙂" :
                        avgMoodScore >= 2.5 ? "😐" :
                            avgMoodScore >= 1.5 ? "😟" : "😔"
                : null;
            return {
                ...member,
                status: member.isVerified ? "active" : "pending",
                sessionCount: sessionCountMap.get(member.id) || 0,
                avgMood,
            };
        }));
    }
    catch (error) {
        console.error("[getOrgMembers]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrgMembers = getOrgMembers;
const getOrgCoaches = async (req, res) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId)
            return res.status(401).json({ message: "Unauthorized" });
        const assignments = await prisma_1.default.organizationCoach.findMany({
            where: { organizationId: orgId },
            orderBy: { assignedAt: "desc" },
            include: {
                coach: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        speciality: true,
                        bio: true,
                        isActive: true,
                        avatar: true,
                        createdAt: true,
                    },
                },
            },
        });
        const coaches = assignments.map(a => a.coach);
        return res.status(200).json(coaches);
    }
    catch (error) {
        console.error("[getOrgCoaches]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrgCoaches = getOrgCoaches;
const getOrgOutcomes = async (req, res) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId)
            return res.status(401).json({ message: "Unauthorized" });
        const organization = await prisma_1.default.organization.findUnique({ where: { id: orgId } });
        if (!organization)
            return res.status(404).json({ message: "Organization not found" });
        const outcomes = await (0, orgStats_service_1.buildOrgOutcomesMetrics)(orgId);
        return res.status(200).json(outcomes);
    }
    catch (error) {
        console.error("[getOrgOutcomes]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrgOutcomes = getOrgOutcomes;
const getOrgSettings = async (req, res) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId)
            return res.status(401).json({ message: "Unauthorized" });
        const organization = await prisma_1.default.organization.findUnique({
            where: { id: orgId },
            select: {
                id: true,
                name: true,
                type: true,
                plan: true,
                primaryContactName: true,
                primaryContactEmail: true,
                status: true,
                notifyWeeklyReport: true,
                notifyCrisisAlerts: true,
                notifyNewMembers: true,
            },
        });
        if (!organization)
            return res.status(404).json({ message: "Organization not found" });
        return res.status(200).json(organization);
    }
    catch (error) {
        console.error("[getOrgSettings]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOrgSettings = getOrgSettings;
const updateOrgSettings = async (req, res) => {
    try {
        const orgId = req.user?.orgId;
        if (!orgId)
            return res.status(401).json({ message: "Unauthorized" });
        const { name, type, notifyWeeklyReport, notifyCrisisAlerts, notifyNewMembers } = req.body;
        const updated = await prisma_1.default.organization.update({
            where: { id: orgId },
            data: {
                ...(name !== undefined ? { name } : {}),
                ...(type !== undefined ? { type } : {}),
                ...(notifyWeeklyReport !== undefined ? { notifyWeeklyReport: Boolean(notifyWeeklyReport) } : {}),
                ...(notifyCrisisAlerts !== undefined ? { notifyCrisisAlerts: Boolean(notifyCrisisAlerts) } : {}),
                ...(notifyNewMembers !== undefined ? { notifyNewMembers: Boolean(notifyNewMembers) } : {}),
            },
            select: {
                id: true,
                name: true,
                type: true,
                plan: true,
                primaryContactName: true,
                primaryContactEmail: true,
                status: true,
                notifyWeeklyReport: true,
                notifyCrisisAlerts: true,
                notifyNewMembers: true,
            },
        });
        return res.status(200).json(updated);
    }
    catch (error) {
        console.error("[updateOrgSettings]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateOrgSettings = updateOrgSettings;
