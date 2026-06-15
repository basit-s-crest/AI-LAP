"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteManualSessionNote = exports.updateManualSessionNote = exports.createManualSessionNote = exports.getSessionNoteVersions = exports.saveSessionNote = exports.getSessionNote = exports.getCoachSessionNotes = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getCoachSessionNotes = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const notes = await prisma_1.default.sessionNote.findMany({
            where: { coachId },
            include: {
                versions: {
                    orderBy: { version: "desc" },
                    take: 1,
                },
                member: { select: { id: true, name: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        const mappedNotes = notes.map((note) => {
            const latest = note.versions[0];
            return {
                id: note.id,
                sessionId: note.sessionId,
                coachId: note.coachId,
                memberId: note.memberId,
                clientName: note.member.name,
                aiSessionNoteId: note.aiSessionNoteId,
                status: note.status,
                createdAt: note.createdAt.toISOString(),
                updatedAt: note.updatedAt.toISOString(),
                version: latest ? latest.version : null,
                summary: latest ? latest.summary : "",
                keyThemes: latest ? latest.keyThemes : [],
                memberSentiment: latest ? latest.memberSentiment : "Neutral",
                coachObservations: latest ? latest.coachObservations : "",
                riskFlag: latest ? latest.riskFlag : false,
                riskNotes: latest ? latest.riskNotes : "",
                recommendedFollowUp: latest ? latest.recommendedFollowUp : "",
            };
        });
        return res.status(200).json({ notes: mappedNotes });
    }
    catch (error) {
        console.error("[getCoachSessionNotes]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getCoachSessionNotes = getCoachSessionNotes;
const getSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const { sessionId } = req.params;
        const session = await prisma_1.default.session.findUnique({
            where: { id: sessionId },
        });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        if (session.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const note = await prisma_1.default.sessionNote.findUnique({
            where: { sessionId },
            include: {
                versions: {
                    orderBy: { version: "desc" },
                    take: 1,
                },
                member: { select: { id: true, name: true } },
            },
        });
        if (note) {
            const latest = note.versions[0];
            return res.status(200).json({
                exists: true,
                note: {
                    id: note.id,
                    sessionId: note.sessionId,
                    coachId: note.coachId,
                    memberId: note.memberId,
                    clientName: note.member.name,
                    aiSessionNoteId: note.aiSessionNoteId,
                    status: note.status,
                    createdAt: note.createdAt.toISOString(),
                    updatedAt: note.updatedAt.toISOString(),
                    version: latest ? latest.version : null,
                    summary: latest ? latest.summary : "",
                    keyThemes: latest ? latest.keyThemes : [],
                    memberSentiment: latest ? latest.memberSentiment : "Neutral",
                    coachObservations: latest ? latest.coachObservations : "",
                    riskFlag: latest ? latest.riskFlag : false,
                    riskNotes: latest ? latest.riskNotes : "",
                    recommendedFollowUp: latest ? latest.recommendedFollowUp : "",
                    createdById: latest ? latest.createdById : "",
                    versionCreatedAt: latest ? latest.createdAt.toISOString() : "",
                },
            });
        }
        // Prefill from AiSessionNote if exists
        const aiNote = await prisma_1.default.aiSessionNote.findFirst({
            where: { sessionId },
        });
        if (aiNote) {
            return res.status(200).json({
                exists: false,
                prefillData: {
                    aiSessionNoteId: aiNote.id,
                    summary: aiNote.summary,
                    keyThemes: aiNote.keyThemes,
                    memberSentiment: aiNote.memberSentiment,
                    coachObservations: aiNote.coachObservations,
                    riskFlag: aiNote.riskFlag,
                    riskNotes: aiNote.riskNotes,
                    recommendedFollowUp: aiNote.recommendedFollowUp,
                },
            });
        }
        return res.status(200).json({
            exists: false,
            prefillData: null,
        });
    }
    catch (error) {
        console.error("[getSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getSessionNote = getSessionNote;
const saveSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const { sessionId } = req.params;
        const { summary, keyThemes, memberSentiment, coachObservations, riskFlag, riskNotes, recommendedFollowUp, status, aiSessionNoteId, } = req.body;
        if (!status || (status !== "DRAFT" && status !== "FINAL")) {
            return res.status(400).json({ message: "Invalid status. Must be DRAFT or FINAL" });
        }
        const session = await prisma_1.default.session.findUnique({
            where: { id: sessionId },
        });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        if (session.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const validatedKeyThemes = Array.isArray(keyThemes) ? keyThemes : [];
        const result = await prisma_1.default.$transaction(async (tx) => {
            let note = await tx.sessionNote.findUnique({
                where: { sessionId },
            });
            let newVersionNumber = 1;
            if (!note) {
                note = await tx.sessionNote.create({
                    data: {
                        sessionId,
                        coachId,
                        memberId: session.memberId,
                        aiSessionNoteId: aiSessionNoteId || null,
                        status,
                    },
                });
            }
            else {
                const latestVersion = await tx.sessionNoteVersion.findFirst({
                    where: { noteId: note.id },
                    orderBy: { version: "desc" },
                });
                if (latestVersion) {
                    newVersionNumber = latestVersion.version + 1;
                }
                note = await tx.sessionNote.update({
                    where: { id: note.id },
                    data: {
                        status,
                        updatedAt: new Date(),
                    },
                });
            }
            const version = await tx.sessionNoteVersion.create({
                data: {
                    noteId: note.id,
                    version: newVersionNumber,
                    summary: summary || "",
                    keyThemes: validatedKeyThemes,
                    memberSentiment: memberSentiment || "Neutral",
                    coachObservations: coachObservations || "",
                    riskFlag: riskFlag ?? false,
                    riskNotes: riskNotes || "",
                    recommendedFollowUp: recommendedFollowUp || "",
                    createdById: coachId,
                },
            });
            return { note, version };
        });
        const member = await prisma_1.default.user.findUnique({
            where: { id: session.memberId },
            select: { name: true },
        });
        return res.status(200).json({
            message: "Session note saved successfully",
            note: {
                id: result.note.id,
                sessionId: result.note.sessionId,
                coachId: result.note.coachId,
                memberId: result.note.memberId,
                clientName: member?.name || "",
                aiSessionNoteId: result.note.aiSessionNoteId,
                status: result.note.status,
                createdAt: result.note.createdAt.toISOString(),
                updatedAt: result.note.updatedAt.toISOString(),
                version: result.version.version,
                summary: result.version.summary,
                keyThemes: result.version.keyThemes,
                memberSentiment: result.version.memberSentiment,
                coachObservations: result.version.coachObservations,
                riskFlag: result.version.riskFlag,
                riskNotes: result.version.riskNotes,
                recommendedFollowUp: result.version.recommendedFollowUp,
                createdById: result.version.createdById,
                versionCreatedAt: result.version.createdAt.toISOString(),
            },
        });
    }
    catch (error) {
        console.error("[saveSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.saveSessionNote = saveSessionNote;
const getSessionNoteVersions = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const { sessionId } = req.params;
        const session = await prisma_1.default.session.findUnique({
            where: { id: sessionId },
        });
        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }
        if (session.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        const note = await prisma_1.default.sessionNote.findUnique({
            where: { sessionId },
        });
        if (!note) {
            return res.status(404).json({ message: "Session note not found" });
        }
        const versions = await prisma_1.default.sessionNoteVersion.findMany({
            where: { noteId: note.id },
            orderBy: { version: "desc" },
        });
        return res.status(200).json({ versions });
    }
    catch (error) {
        console.error("[getSessionNoteVersions]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getSessionNoteVersions = getSessionNoteVersions;
const createManualSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const { memberId, notes, nextSessionGoal, status } = req.body;
        if (!memberId) {
            return res.status(400).json({ message: "memberId is required" });
        }
        let noteStatus = "DRAFT";
        if (status === "saved" || status === "FINAL") {
            noteStatus = "FINAL";
        }
        const owns = await prisma_1.default.coachMember.findUnique({
            where: { coachId_userId: { coachId, userId: memberId } },
        });
        if (!owns) {
            return res.status(403).json({ message: "Member is not assigned to this coach" });
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const note = await tx.sessionNote.create({
                data: {
                    coachId,
                    memberId,
                    sessionId: null,
                    status: noteStatus,
                },
            });
            const version = await tx.sessionNoteVersion.create({
                data: {
                    noteId: note.id,
                    version: 1,
                    summary: notes || "",
                    keyThemes: [],
                    memberSentiment: "Neutral",
                    coachObservations: notes || "",
                    riskFlag: false,
                    riskNotes: "",
                    recommendedFollowUp: nextSessionGoal || "",
                    createdById: coachId,
                },
            });
            return { note, version };
        });
        const member = await prisma_1.default.user.findUnique({
            where: { id: memberId },
            select: { name: true },
        });
        return res.status(201).json({
            note: {
                id: result.note.id,
                sessionId: null,
                coachId: result.note.coachId,
                memberId: result.note.memberId,
                clientName: member?.name || "",
                aiSessionNoteId: null,
                status: result.note.status,
                createdAt: result.note.createdAt.toISOString(),
                updatedAt: result.note.updatedAt.toISOString(),
                version: 1,
                summary: result.version.summary,
                keyThemes: [],
                memberSentiment: "Neutral",
                coachObservations: result.version.coachObservations,
                riskFlag: false,
                riskNotes: "",
                recommendedFollowUp: result.version.recommendedFollowUp,
            },
        });
    }
    catch (error) {
        console.error("[createManualSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.createManualSessionNote = createManualSessionNote;
const updateManualSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const noteId = req.params.id;
        const { notes, nextSessionGoal, status } = req.body;
        const existing = await prisma_1.default.sessionNote.findUnique({
            where: { id: noteId },
        });
        if (!existing) {
            return res.status(404).json({ message: "Note not found" });
        }
        if (existing.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        let noteStatus = "DRAFT";
        if (status === "saved" || status === "FINAL") {
            noteStatus = "FINAL";
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const latest = await tx.sessionNoteVersion.findFirst({
                where: { noteId },
                orderBy: { version: "desc" },
            });
            const nextVersion = latest ? latest.version + 1 : 1;
            const updatedNote = await tx.sessionNote.update({
                where: { id: noteId },
                data: {
                    status: noteStatus,
                    updatedAt: new Date(),
                },
            });
            const newVersion = await tx.sessionNoteVersion.create({
                data: {
                    noteId,
                    version: nextVersion,
                    summary: notes !== undefined ? notes : (latest?.summary || ""),
                    keyThemes: latest?.keyThemes || [],
                    memberSentiment: latest?.memberSentiment || "Neutral",
                    coachObservations: notes !== undefined ? notes : (latest?.coachObservations || ""),
                    riskFlag: latest?.riskFlag || false,
                    riskNotes: latest?.riskNotes || "",
                    recommendedFollowUp: nextSessionGoal !== undefined ? nextSessionGoal : (latest?.recommendedFollowUp || ""),
                    createdById: coachId,
                },
            });
            return { note: updatedNote, version: newVersion };
        });
        const member = await prisma_1.default.user.findUnique({
            where: { id: result.note.memberId },
            select: { name: true },
        });
        return res.status(200).json({
            note: {
                id: result.note.id,
                sessionId: result.note.sessionId,
                coachId: result.note.coachId,
                memberId: result.note.memberId,
                clientName: member?.name || "",
                aiSessionNoteId: result.note.aiSessionNoteId,
                status: result.note.status,
                createdAt: result.note.createdAt.toISOString(),
                updatedAt: result.note.updatedAt.toISOString(),
                version: result.version.version,
                summary: result.version.summary,
                keyThemes: result.version.keyThemes,
                memberSentiment: result.version.memberSentiment,
                coachObservations: result.version.coachObservations,
                riskFlag: result.version.riskFlag,
                riskNotes: result.version.riskNotes,
                recommendedFollowUp: result.version.recommendedFollowUp,
            },
        });
    }
    catch (error) {
        console.error("[updateManualSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.updateManualSessionNote = updateManualSessionNote;
const deleteManualSessionNote = async (req, res) => {
    try {
        const coachId = req.user?.id;
        if (!coachId)
            return res.status(401).json({ message: "Unauthorized" });
        const noteId = req.params.id;
        const existing = await prisma_1.default.sessionNote.findUnique({
            where: { id: noteId },
        });
        if (!existing) {
            return res.status(404).json({ message: "Note not found" });
        }
        if (existing.coachId !== coachId) {
            return res.status(403).json({ message: "Forbidden" });
        }
        await prisma_1.default.sessionNote.delete({
            where: { id: noteId },
        });
        return res.status(200).json({ message: "Note deleted successfully" });
    }
    catch (error) {
        console.error("[deleteManualSessionNote]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.deleteManualSessionNote = deleteManualSessionNote;
