"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCoachNotifications = exports.updateCoachProfile = exports.getCoachProfile = exports.setOnDemandStatus = exports.getOnDemandStatus = exports.getMyMembers = exports.assignCoachHandler = exports.getCoachPublicByIdHandler = exports.listCoachesHandler = exports.loginCoach = exports.registerCoach = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const notificationEmail_service_1 = require("../services/notificationEmail.service");
const auth_service_1 = require("../services/auth.service");
const member_org_coach_service_1 = require("../services/member-org-coach.service");
// ─── Helpers ──────────────────────────────────────────────────────────────────
const sanitizeCoach = (coach) => ({
    id: coach.id,
    email: coach.email,
    name: coach.name,
    avatar: coach.avatar,
    bio: coach.orgAssignments && coach.orgAssignments.length > 0
        ? coach.orgAssignments.map((a) => a.organization.name).join(", ")
        : coach.bio,
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
        const platform = await prisma_1.default.platformSettings.findUnique({
            where: { id: "platform" },
            select: { maintenanceMode: true },
        });
        if (platform?.maintenanceMode) {
            return res.status(503).json({ message: "Site is under maintenance" });
        }
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
 * Members: active coaches in their org (OrganizationCoach only). No org → [].
 * Other authenticated roles: all active coaches (unchanged for staff flows).
 */
const listCoachesHandler = async (req, res) => {
    try {
        const role = req.user?.role;
        if (role === "member" && req.user?.id) {
            const coaches = await (0, member_org_coach_service_1.getActiveCoachesForMemberOrganization)(req.user.id);
            return res.status(200).json({ coaches: coaches.map(sanitizeCoach) });
        }
        const coaches = await prisma_1.default.coach.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            include: {
                orgAssignments: {
                    include: { organization: { select: { name: true } } },
                },
            },
        });
        return res.status(200).json({ coaches: coaches.map(sanitizeCoach) });
    }
    catch (error) {
        console.error("[listCoachesHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.listCoachesHandler = listCoachesHandler;
/**
 * GET /api/coach/:coachId
 * Member: coach must be in member's org (OrganizationCoach). No org → 403.
 * Coach: only own profile. Organization: coach must be assigned to JWT orgId.
 */
const getCoachPublicByIdHandler = async (req, res) => {
    try {
        const coachId = req.params.coachId;
        const u = req.user;
        if (!u?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (u.role === "member") {
            const ok = await (0, member_org_coach_service_1.memberOrganizationHasActiveCoach)(u.id, coachId);
            if (!ok) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        else if (u.role === "coach") {
            if (u.id !== coachId) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        else if (u.role === "organization") {
            if (!u.orgId) {
                return res.status(403).json({ message: "Forbidden" });
            }
            const link = await prisma_1.default.organizationCoach.findUnique({
                where: {
                    organizationId_coachId: { organizationId: u.orgId, coachId },
                },
                include: { coach: true },
            });
            if (!link?.coach?.isActive) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }
        const coach = await prisma_1.default.coach.findFirst({
            where: { id: coachId, isActive: true },
            include: {
                orgAssignments: {
                    include: { organization: { select: { name: true } } },
                },
            },
        });
        if (!coach) {
            return res.status(404).json({ message: "Coach not found" });
        }
        return res.status(200).json({ coach: sanitizeCoach(coach) });
    }
    catch (error) {
        console.error("[getCoachPublicByIdHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCoachPublicByIdHandler = getCoachPublicByIdHandler;
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
        if (req.user?.role === "member") {
            const inOrg = await (0, member_org_coach_service_1.memberOrganizationHasActiveCoach)(userId, coachId);
            if (!inOrg) {
                return res.status(403).json({ message: "Forbidden" });
            }
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
        if (!existing) {
            void (0, notificationEmail_service_1.emailCoachNewClientAssigned)(coachId, userId);
        }
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
// ─── On-Demand Status ─────────────────────────────────────────────────────────
/**
 * GET /api/coach/on-demand
 * Coach only. Returns the current on-demand (isActive) status.
 */
const getOnDemandStatus = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const coach = await prisma_1.default.coach.findUnique({
            where: { id: coachId },
            select: { isActive: true },
        });
        if (!coach)
            return res.status(404).json({ message: "Coach not found" });
        return res.status(200).json({ onDemand: coach.isActive });
    }
    catch (error) {
        console.error("[getOnDemandStatus]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getOnDemandStatus = getOnDemandStatus;
/**
 * PATCH /api/coach/on-demand
 * Coach only. Updates the on-demand (isActive) status.
 * Body: { onDemand: boolean }
 */
const setOnDemandStatus = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const { onDemand } = req.body;
        if (typeof onDemand !== "boolean") {
            return res.status(400).json({ message: "onDemand must be a boolean" });
        }
        const previous = await prisma_1.default.coach.findUnique({
            where: { id: coachId },
            select: { isActive: true },
        });
        const coach = await prisma_1.default.coach.update({
            where: { id: coachId },
            data: { isActive: onDemand },
            select: { isActive: true },
        });
        if (onDemand && previous && !previous.isActive) {
            void (0, notificationEmail_service_1.emailOrgMembersCoachOnDemand)(coachId);
        }
        return res.status(200).json({ onDemand: coach.isActive });
    }
    catch (error) {
        console.error("[setOnDemandStatus]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.setOnDemandStatus = setOnDemandStatus;
// ─── Coach profile & settings ─────────────────────────────────────────────────
/** GET /api/coach/profile */
const getCoachProfile = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId || req.user?.role !== "coach") {
            return res.status(403).json({ message: "Forbidden" });
        }
        const coach = await prisma_1.default.coach.findUnique({ where: { id: coachId } });
        if (!coach)
            return res.status(404).json({ message: "Coach not found" });
        return res.status(200).json({
            coach: sanitizeCoach(coach),
            notifications: {
                notifySessionReminders: coach.notifySessionReminders,
                notifyNewClientAssigned: coach.notifyNewClientAssigned,
                notifyMessageAlerts: coach.notifyMessageAlerts,
            },
        });
    }
    catch (error) {
        console.error("[getCoachProfile]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCoachProfile = getCoachProfile;
/** PATCH /api/coach/profile */
const updateCoachProfile = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId || req.user?.role !== "coach") {
            return res.status(403).json({ message: "Forbidden" });
        }
        const { name, bio, speciality, avatar, newPassword, confirmPassword } = req.body;
        if (newPassword !== undefined) {
            if (!newPassword || newPassword !== confirmPassword) {
                return res.status(400).json({ message: "Passwords do not match" });
            }
            if (newPassword.length < 8) {
                return res.status(400).json({ message: "Password must be at least 8 characters" });
            }
        }
        const coach = await prisma_1.default.coach.update({
            where: { id: coachId },
            data: {
                ...(name !== undefined ? { name: name.trim() } : {}),
                ...(bio !== undefined ? { bio } : {}),
                ...(speciality !== undefined ? { speciality } : {}),
                ...(avatar !== undefined ? { avatar } : {}),
                ...(newPassword ? { password: await (0, auth_service_1.hashPassword)(newPassword) } : {}),
            },
        });
        return res.status(200).json({ coach: sanitizeCoach(coach) });
    }
    catch (error) {
        console.error("[updateCoachProfile]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateCoachProfile = updateCoachProfile;
/** PATCH /api/coach/notifications */
const updateCoachNotifications = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId || req.user?.role !== "coach") {
            return res.status(403).json({ message: "Forbidden" });
        }
        const { notifySessionReminders, notifyNewClientAssigned, notifyMessageAlerts, } = req.body;
        const coach = await prisma_1.default.coach.update({
            where: { id: coachId },
            data: {
                ...(notifySessionReminders !== undefined
                    ? { notifySessionReminders: Boolean(notifySessionReminders) }
                    : {}),
                ...(notifyNewClientAssigned !== undefined
                    ? { notifyNewClientAssigned: Boolean(notifyNewClientAssigned) }
                    : {}),
                ...(notifyMessageAlerts !== undefined
                    ? { notifyMessageAlerts: Boolean(notifyMessageAlerts) }
                    : {}),
            },
        });
        return res.status(200).json({
            notifySessionReminders: coach.notifySessionReminders,
            notifyNewClientAssigned: coach.notifyNewClientAssigned,
            notifyMessageAlerts: coach.notifyMessageAlerts,
        });
    }
    catch (error) {
        console.error("[updateCoachNotifications]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateCoachNotifications = updateCoachNotifications;
