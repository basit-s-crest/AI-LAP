"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyMembers = exports.assignCoachHandler = exports.listCoachesHandler = exports.loginCoach = exports.registerCoach = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_service_1 = require("../services/auth.service");
// ─── Helpers ──────────────────────────────────────────────────────────────────
const sanitizeCoach = (coach) => ({
    id: coach.id,
    email: coach.email,
    name: coach.name,
    avatar: coach.avatar,
    bio: coach.bio,
    speciality: coach.speciality,
    isActive: coach.isActive,
    createdAt: coach.createdAt,
    updatedAt: coach.updatedAt,
});
// ─── Register Coach ───────────────────────────────────────────────────────────
/**
 * POST /api/coach/register
 * Coaches are created by admins or via a separate onboarding flow.
 * No email verification required — coaches are trusted accounts.
 */
const registerCoach = async (req, res) => {
    try {
        const { email, name, password, avatar, bio, speciality } = req.body;
        if (!email || !name || !password) {
            return res
                .status(400)
                .json({ message: "Name, email and password are required" });
        }
        const existing = await prisma_1.default.coach.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ message: "Email already registered" });
        }
        const hashedPassword = await (0, auth_service_1.hashPassword)(password);
        const coach = await prisma_1.default.coach.create({
            data: {
                email,
                name,
                password: hashedPassword,
                avatar: avatar ?? null,
                bio: bio ?? null,
                speciality: speciality ?? null,
            },
        });
        return res.status(201).json({
            message: "Coach account created successfully",
            coach: sanitizeCoach(coach),
        });
    }
    catch (error) {
        console.error("[registerCoach]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.registerCoach = registerCoach;
// ─── Login Coach ──────────────────────────────────────────────────────────────
/**
 * POST /api/coach/login
 * Body: { email, password }
 * Returns a JWT with role: "coach".
 */
const loginCoach = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password are required" });
        }
        const coach = await prisma_1.default.coach.findUnique({ where: { email } });
        if (!coach) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        if (!coach.isActive) {
            return res
                .status(403)
                .json({ message: "Account is deactivated. Contact support." });
        }
        const isPasswordValid = await (0, auth_service_1.comparePassword)(password, coach.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = (0, auth_service_1.generateToken)(coach.id, "coach");
        return res.status(200).json({
            message: "Login successful",
            token,
            // Return as "user" key with role injected so the frontend mapper works
            // identically for both member and coach login responses
            user: { ...sanitizeCoach(coach), role: "coach" },
        });
    }
    catch (error) {
        console.error("[loginCoach]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.loginCoach = loginCoach;
// ─── List Active Coaches ──────────────────────────────────────────────────────
/**
 * GET /api/coach/list
 * Returns all active coaches, sorted by name, with password stripped.
 */
const listCoachesHandler = async (req, res) => {
    try {
        const coaches = await prisma_1.default.coach.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        return res.status(200).json({ coaches: coaches.map(sanitizeCoach) });
    }
    catch (error) {
        console.error("[listCoachesHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.listCoachesHandler = listCoachesHandler;
// ─── Assign Coach to Member ───────────────────────────────────────────────────
/**
 * POST /api/coach/assign
 * Body: { coachId }
 * Assigns the authenticated member to the given coach.
 * Returns 201 on new assignment, 200 if already assigned.
 */
const assignCoachHandler = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { coachId } = req.body;
        if (!coachId || typeof coachId !== "string" || coachId.trim() === "") {
            return res.status(400).json({ message: "coachId is required" });
        }
        const coach = await prisma_1.default.coach.findUnique({ where: { id: coachId } });
        if (!coach || !coach.isActive) {
            return res.status(404).json({ message: "Coach not found" });
        }
        // Verify the member's own User record still exists (guards against stale JWTs
        // after a DB reset or data migration where the user row was deleted).
        const member = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!member) {
            return res.status(404).json({
                message: "Your account was not found. Please log out and register again.",
            });
        }
        // Check for an existing assignment before upserting so we can detect creation
        const existing = await prisma_1.default.coachMember.findFirst({
            where: { coachId, userId },
        });
        const result = await prisma_1.default.coachMember.upsert({
            where: { coachId_userId: { coachId, userId: userId } },
            update: {},
            create: { coachId, userId: userId },
        });
        const statusCode = existing ? 200 : 201;
        return res.status(statusCode).json({
            assigned: true,
            coachId,
            assignedAt: result.assignedAt.toISOString(),
        });
    }
    catch (error) {
        console.error("[assignCoachHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.assignCoachHandler = assignCoachHandler;
// ─── Get Coach's Members ──────────────────────────────────────────────────────
/**
 * GET /api/coach/members
 * Returns all members assigned to the authenticated coach.
 */
const getMyMembers = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const assignments = await prisma_1.default.coachMember.findMany({
            where: { coachId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        avatar: true,
                        isVerified: true,
                        createdAt: true,
                    },
                },
            },
        });
        const members = assignments.map((a) => ({
            ...a.user,
            assignedAt: a.assignedAt,
        }));
        return res.status(200).json({ members });
    }
    catch (error) {
        console.error("[getMyMembers]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMyMembers = getMyMembers;
