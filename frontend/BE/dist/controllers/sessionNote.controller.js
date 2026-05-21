"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSessionNote = exports.updateSessionNote = exports.getCoachSessionNotes = exports.createSessionNote = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const SESSION_TYPES = [
    "Weekly Check-in",
    "Initial Session",
    "Follow-up",
    "Crisis",
];
const STATUSES = ["draft", "saved"];
function isSessionType(value) {
    return SESSION_TYPES.includes(value);
}
function isStatus(value) {
    return STATUSES.includes(value);
}
async function coachOwnsMember(coachId, memberId) {
    const assignment = await prisma_1.default.coachMember.findUnique({
        where: { coachId_userId: { coachId, userId: memberId } },
    });
    return !!assignment;
}
function toDto(note) {
    return {
        id: note.id,
        coachId: note.coachId,
        memberId: note.memberId,
        clientName: note.member.name,
        sessionType: note.sessionType,
        notes: note.notes,
        nextSessionGoal: note.nextSessionGoal,
        status: note.status,
        sessionDate: note.createdAt.toISOString(),
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
    };
}
const createSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const { memberId, sessionType, notes, nextSessionGoal, status } = req.body;
        if (!memberId || !sessionType) {
            return res.status(400).json({ message: "memberId and sessionType are required" });
        }
        if (!isSessionType(sessionType)) {
            return res.status(400).json({ message: "Invalid sessionType" });
        }
        const noteStatus = status ?? "draft";
        if (!isStatus(noteStatus)) {
            return res.status(400).json({ message: "status must be draft or saved" });
        }
        const owns = await coachOwnsMember(coachId, memberId);
        if (!owns) {
            return res.status(403).json({ message: "Member is not assigned to this coach" });
        }
        const created = await prisma_1.default.sessionNote.create({
            data: {
                coachId,
                memberId,
                sessionType,
                notes: notes ?? "",
                nextSessionGoal: nextSessionGoal ?? "",
                status: noteStatus,
            },
            include: { member: { select: { id: true, name: true } } },
        });
        return res.status(201).json({ note: toDto(created) });
    }
    catch (error) {
        console.error("[createSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.createSessionNote = createSessionNote;
const getCoachSessionNotes = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ message: "Unauthorized" });
        const { coachId } = req.params;
        if (user.role !== "coach" || user.id !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const notes = await prisma_1.default.sessionNote.findMany({
            where: { coachId },
            include: { member: { select: { id: true, name: true } } },
            orderBy: { createdAt: "desc" },
        });
        return res.status(200).json({ notes: notes.map(toDto) });
    }
    catch (error) {
        console.error("[getCoachSessionNotes]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCoachSessionNotes = getCoachSessionNotes;
const updateSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const existing = await prisma_1.default.sessionNote.findUnique({ where: { id: req.params.id } });
        if (!existing)
            return res.status(404).json({ message: "Note not found" });
        if (existing.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const { memberId, sessionType, notes, nextSessionGoal, status } = req.body;
        if (sessionType !== undefined && !isSessionType(sessionType)) {
            return res.status(400).json({ message: "Invalid sessionType" });
        }
        if (status !== undefined && !isStatus(status)) {
            return res.status(400).json({ message: "status must be draft or saved" });
        }
        if (memberId !== undefined && memberId !== existing.memberId) {
            const owns = await coachOwnsMember(coachId, memberId);
            if (!owns) {
                return res.status(403).json({ message: "Member is not assigned to this coach" });
            }
        }
        const updated = await prisma_1.default.sessionNote.update({
            where: { id: req.params.id },
            data: {
                ...(memberId !== undefined && { memberId }),
                ...(sessionType !== undefined && { sessionType }),
                ...(notes !== undefined && { notes }),
                ...(nextSessionGoal !== undefined && { nextSessionGoal }),
                ...(status !== undefined && { status }),
            },
            include: { member: { select: { id: true, name: true } } },
        });
        return res.status(200).json({ note: toDto(updated) });
    }
    catch (error) {
        console.error("[updateSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateSessionNote = updateSessionNote;
const deleteSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const existing = await prisma_1.default.sessionNote.findUnique({ where: { id: req.params.id } });
        if (!existing)
            return res.status(404).json({ message: "Note not found" });
        if (existing.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_1.default.sessionNote.delete({ where: { id: req.params.id } });
        return res.status(200).json({ message: "Note deleted" });
    }
    catch (error) {
        console.error("[deleteSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteSessionNote = deleteSessionNote;
