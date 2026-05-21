"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescheduleSession = exports.cancelSession = exports.getMemberSessions = exports.bookSession = exports.getCoachSessions = exports.saveCoachAvailability = exports.getCoachAvailability = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const member_org_coach_service_1 = require("../services/member-org-coach.service");
const notificationEmail_service_1 = require("../services/notificationEmail.service");
/** Member / org / self-coach may read availability; others forbidden. */
async function assertCanViewCoachAvailability(user, coachId) {
    if (user.role === "member") {
        return (0, member_org_coach_service_1.memberOrganizationHasActiveCoach)(user.id, coachId);
    }
    if (user.role === "coach") {
        return user.id === coachId;
    }
    if (user.role === "organization") {
        if (!user.orgId)
            return false;
        const link = await prisma_1.default.organizationCoach.findUnique({
            where: {
                organizationId_coachId: { organizationId: user.orgId, coachId },
            },
            include: { coach: true },
        });
        return !!(link?.coach?.isActive);
    }
    return true;
}
// ─── GET /api/sessions/availability/:coachId ─────────────────────────────────
// Auth required. Returns the coach's saved availability slots and duration.
const getCoachAvailability = async (req, res) => {
    try {
        const { coachId } = req.params;
        const user = req.user;
        const allowed = await assertCanViewCoachAvailability(user, coachId);
        if (!allowed) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const bookedToday = await prisma_1.default.session.findMany({
            where: {
                coachId,
                scheduledAt: { gte: today, lt: tomorrow },
                status: { not: "cancelled" },
            },
            select: { scheduledAt: true, memberId: true },
        });
        const avail = await prisma_1.default.coachAvailability.findUnique({
            where: { coachId },
        });
        if (!avail) {
            return res.status(200).json({
                slots: [],
                duration: 50,
                bookedToday: bookedToday.map((b) => ({
                    date: b.scheduledAt.toISOString(),
                    memberId: b.memberId,
                })),
            });
        }
        return res.status(200).json({
            slots: avail.slots,
            duration: avail.duration,
            bookedToday: bookedToday.map((b) => ({
                date: b.scheduledAt.toISOString(),
                memberId: b.memberId,
            })),
        });
    }
    catch (error) {
        console.error("[getCoachAvailability]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCoachAvailability = getCoachAvailability;
// ─── PATCH /api/sessions/availability ────────────────────────────────────────
// Coach only. Upserts the logged-in coach's availability.
const saveCoachAvailability = async (req, res) => {
    try {
        const coachId = req.user.id;
        const { slots, duration } = req.body;
        if (!Array.isArray(slots)) {
            return res.status(400).json({ message: "slots must be an array" });
        }
        const avail = await prisma_1.default.coachAvailability.upsert({
            where: { coachId },
            create: {
                coachId,
                slots,
                duration: duration ?? 50,
                updatedAt: new Date(),
            },
            update: {
                slots,
                duration: duration ?? 50,
                updatedAt: new Date(),
            },
        });
        return res.status(200).json({ slots: avail.slots, duration: avail.duration });
    }
    catch (error) {
        console.error("[saveCoachAvailability]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.saveCoachAvailability = saveCoachAvailability;
// ─── GET /api/sessions/coach ──────────────────────────────────────────────────
// Coach only. Returns all sessions for the logged-in coach with member names.
const getCoachSessions = async (req, res) => {
    try {
        const coachId = req.user.id;
        const sessions = await prisma_1.default.session.findMany({
            where: { coachId },
            orderBy: { scheduledAt: "desc" },
        });
        // Batch-fetch member names
        const memberIds = [...new Set(sessions.map((s) => s.memberId))];
        const members = await prisma_1.default.user.findMany({
            where: { id: { in: memberIds } },
            select: { id: true, name: true },
        });
        const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));
        return res.status(200).json(sessions.map((s) => ({
            id: s.id,
            coachId: s.coachId,
            memberId: s.memberId,
            memberName: memberMap[s.memberId] ?? "Unknown",
            date: s.scheduledAt,
            duration: s.duration,
            type: s.type,
            status: s.status,
            createdAt: s.createdAt,
        })));
    }
    catch (error) {
        console.error("[getCoachSessions]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCoachSessions = getCoachSessions;
// ─── POST /api/sessions/book ──────────────────────────────────────────────────
// Auth required (member). Books a session with a coach.
const bookSession = async (req, res) => {
    try {
        if (req.user?.role !== "member") {
            return res.status(403).json({ message: "Forbidden" });
        }
        const memberId = req.user.id;
        const { coachId, date } = req.body;
        if (!coachId || !date) {
            return res.status(400).json({ message: "coachId and date are required" });
        }
        const inOrg = await (0, member_org_coach_service_1.memberOrganizationHasActiveCoach)(memberId, coachId);
        if (!inOrg) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const requestedDate = new Date(date);
        if (isNaN(requestedDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }
        // Check coach has availability configured
        const avail = await prisma_1.default.coachAvailability.findUnique({
            where: { coachId },
        });
        if (avail) {
            const slots = avail.slots;
            const dayName = requestedDate.toLocaleDateString("en-US", { weekday: "long" });
            const enabledDays = slots.filter((s) => s.enabled).map((s) => s.day);
            if (enabledDays.length > 0 && !enabledDays.includes(dayName)) {
                return res.status(400).json({
                    message: `Coach is not available on ${dayName}`,
                });
            }
        }
        const existingSession = await prisma_1.default.session.findFirst({
            where: {
                coachId,
                scheduledAt: requestedDate,
                status: { not: "cancelled" },
            },
        });
        if (existingSession) {
            return res.status(409).json({
                message: "This slot is already booked",
            });
        }
        const memberConflict = await prisma_1.default.session.findFirst({
            where: {
                memberId,
                scheduledAt: requestedDate,
                status: { not: "cancelled" },
            },
        });
        if (memberConflict) {
            return res.status(409).json({
                message: "You already have a session at this time",
            });
        }
        const dur = avail?.duration ?? 50;
        const session = await prisma_1.default.session.create({
            data: {
                coachId,
                memberId,
                scheduledAt: requestedDate,
                duration: dur,
                type: "Weekly Check-in",
                status: "upcoming",
            },
        });
        void (0, notificationEmail_service_1.emailCoachSessionUpdate)(session.id, "booked");
        return res.status(201).json(session);
    }
    catch (error) {
        console.error("[bookSession]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.bookSession = bookSession;
// ─── GET /api/sessions/member ─────────────────────────────────────────────────
// Auth required. Returns all sessions for the logged-in member.
const getMemberSessions = async (req, res) => {
    try {
        const memberId = req.user.id;
        const sessions = await prisma_1.default.session.findMany({
            where: { memberId },
            orderBy: { scheduledAt: "desc" },
        });
        return res.status(200).json(sessions);
    }
    catch (error) {
        console.error("[getMemberSessions]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMemberSessions = getMemberSessions;
const cancelSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { id } = req.params;
        const session = await prisma_1.default.session.findUnique({
            where: { id },
        });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        const isCoach = session.coachId === userId;
        const isMember = session.memberId === userId;
        if (!isCoach && !isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }
        if (session.status === "cancelled") {
            return res.status(400).json({ message: "Session already cancelled" });
        }
        const updated = await prisma_1.default.session.update({
            where: { id },
            data: {
                status: "cancelled",
                cancelledBy: userRole === "coach" ? "coach" : "member",
            },
        });
        if (userRole === "coach") {
            void (0, notificationEmail_service_1.emailMemberSessionUpdate)(updated.id, "cancelled");
        }
        else {
            void (0, notificationEmail_service_1.emailCoachSessionUpdate)(updated.id, "cancelled");
        }
        return res.status(200).json(updated);
    }
    catch (error) {
        console.error("[cancelSession]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.cancelSession = cancelSession;
const rescheduleSession = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { id } = req.params;
        const { newScheduledAt } = req.body;
        if (!newScheduledAt) {
            return res.status(400).json({ message: "newScheduledAt is required" });
        }
        const newDate = new Date(newScheduledAt);
        if (isNaN(newDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }
        if (newDate <= new Date()) {
            return res.status(400).json({ message: "New date must be in the future" });
        }
        const session = await prisma_1.default.session.findUnique({ where: { id } });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        const isCoach = session.coachId === userId;
        const isMember = session.memberId === userId;
        if (!isCoach && !isMember) {
            return res.status(403).json({ message: "Not authorized" });
        }
        if (session.status === "cancelled") {
            return res.status(400).json({ message: "Cannot reschedule a cancelled session" });
        }
        const conflict = await prisma_1.default.session.findFirst({
            where: {
                coachId: session.coachId,
                scheduledAt: newDate,
                status: { not: "cancelled" },
                NOT: { id },
            },
        });
        if (conflict) {
            return res.status(409).json({ message: "New slot is already booked" });
        }
        const dur = session.duration ?? 50;
        const updated = await prisma_1.default.session.update({
            where: { id },
            data: {
                scheduledAt: newDate,
                status: "rescheduled",
                rescheduleBy: userRole === "coach" ? "coach" : "member",
                rescheduleRequest: newDate,
            },
        });
        if (userRole === "coach") {
            void (0, notificationEmail_service_1.emailMemberSessionUpdate)(updated.id, "rescheduled");
        }
        else {
            void (0, notificationEmail_service_1.emailCoachSessionUpdate)(updated.id, "rescheduled");
        }
        return res.status(200).json(updated);
    }
    catch (error) {
        console.error("[rescheduleSession]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.rescheduleSession = rescheduleSession;
