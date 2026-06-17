"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.endVideoSession = exports.getVideoStatus = exports.getVideoToken = exports.startVideoSession = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const livekit_service_1 = require("../services/livekit.service");
const sessionAutoCompleter_1 = require("../services/sessionAutoCompleter");
/**
 * Helper to fetch a session and assert permission
 */
async function getValidatedSession(req, res) {
    const { id } = req.params;
    const user = req.user;
    if (!user) {
        res.status(401).json({ message: "Unauthorized" });
        return null;
    }
    const session = await prisma_1.default.session.findUnique({
        where: { id },
    });
    if (!session) {
        res.status(404).json({ message: "Session not found" });
        return null;
    }
    const isCoach = user.role === "coach" && session.coachId === user.id;
    const isMember = user.role === "member" && session.memberId === user.id;
    if (!isCoach && !isMember) {
        res.status(403).json({ message: "Forbidden: Not authorized to access this session" });
        return null;
    }
    return { session, isCoach, isMember, userId: user.id };
}
/**
 * POST /api/sessions/:id/livekit/start
 * Coach only: Starts the video room, sets the room name if null, updates start timestamp.
 */
const startVideoSession = async (req, res) => {
    try {
        const authContext = await getValidatedSession(req, res);
        if (!authContext)
            return;
        const { session, isCoach } = authContext;
        if (!isCoach) {
            return res.status(403).json({ message: "Forbidden: Only the assigned coach can start the call" });
        }
        if (session.status === "cancelled") {
            return res.status(409).json({ message: "Conflict: Cannot start a cancelled session" });
        }
        if (session.status === "completed" || session.livekitEndedAt) {
            return res.status(409).json({ message: "This session has already ended." });
        }
        // Generate room name if it doesn't exist
        const roomName = session.livekitRoomName || `safecircle-session-${session.id}`;
        const startedAt = session.livekitStartedAt || new Date();
        const updatedSession = await prisma_1.default.session.update({
            where: { id: session.id },
            data: {
                livekitRoomName: roomName,
                livekitStartedAt: startedAt,
            },
        });
        const coach = await prisma_1.default.coach.findUnique({
            where: { id: session.coachId },
            select: { name: true },
        });
        const participantName = coach?.name || "Coach";
        const identity = `coach:${session.coachId}`;
        let tokenDetails;
        try {
            tokenDetails = await livekit_service_1.LiveKitService.generateToken(roomName, identity, participantName, session.duration);
        }
        catch (configError) {
            console.error("[startVideoSession] LiveKit Config Error:", configError.message);
            return res.status(503).json({ message: "LiveKit service is not configured on the server" });
        }
        const expiresAt = new Date(startedAt.getTime() + (session.duration + 15) * 60 * 1000);
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not configured");
        }
        const transcriptionToken = jsonwebtoken_1.default.sign({
            sessionId: session.id,
            coachId: session.coachId,
            memberId: session.memberId,
            requestedBy: authContext.userId,
            speaker: "member",
            purpose: "transcription",
        }, secret, {
            expiresIn: "15m",
        });
        return res.status(200).json({
            sessionId: session.id,
            coachId: session.coachId,
            memberId: session.memberId,
            roomName,
            serverUrl: tokenDetails.serverUrl,
            token: tokenDetails.token,
            identity,
            role: "coach",
            participantName,
            scheduledAt: session.scheduledAt,
            livekitStartedAt: startedAt,
            expiresAt,
            transcriptionToken,
        });
    }
    catch (error) {
        console.error("[startVideoSession] Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.startVideoSession = startVideoSession;
/**
 * POST /api/sessions/:id/livekit/token
 * Coach or Member: Fetch token for a session that has been started.
 */
const getVideoToken = async (req, res) => {
    try {
        const authContext = await getValidatedSession(req, res);
        if (!authContext)
            return;
        const { session, isCoach, isMember } = authContext;
        if (session.status === "cancelled") {
            return res.status(409).json({ message: "Conflict: Session is cancelled" });
        }
        if (session.status === "completed" || session.livekitEndedAt) {
            return res.status(409).json({ message: "This session has already ended." });
        }
        if (!session.livekitStartedAt || !session.livekitRoomName) {
            return res.status(409).json({ message: "Conflict: Meeting has not been started by the coach yet" });
        }
        let participantName = "User";
        let identity = "";
        let role = "";
        if (isCoach) {
            const coach = await prisma_1.default.coach.findUnique({
                where: { id: session.coachId },
                select: { name: true },
            });
            participantName = coach?.name || "Coach";
            identity = `coach:${session.coachId}`;
            role = "coach";
        }
        else if (isMember) {
            const user = await prisma_1.default.user.findUnique({
                where: { id: session.memberId },
                select: { name: true },
            });
            participantName = user?.name || "Member";
            identity = `member:${session.memberId}`;
            role = "user";
        }
        let tokenDetails;
        try {
            tokenDetails = await livekit_service_1.LiveKitService.generateToken(session.livekitRoomName, identity, participantName, session.duration);
        }
        catch (configError) {
            console.error("[getVideoToken] LiveKit Config Error:", configError.message);
            return res.status(503).json({ message: "LiveKit service is not configured on the server" });
        }
        const expiresAt = new Date(session.livekitStartedAt.getTime() + (session.duration + 15) * 60 * 1000);
        let transcriptionToken;
        if (isCoach) {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error("JWT_SECRET is not configured");
            }
            transcriptionToken = jsonwebtoken_1.default.sign({
                sessionId: session.id,
                coachId: session.coachId,
                memberId: session.memberId,
                requestedBy: authContext.userId,
                speaker: "member",
                purpose: "transcription",
            }, secret, {
                expiresIn: "15m",
            });
        }
        return res.status(200).json({
            sessionId: session.id,
            coachId: session.coachId,
            memberId: session.memberId,
            roomName: session.livekitRoomName,
            serverUrl: tokenDetails.serverUrl,
            token: tokenDetails.token,
            identity,
            role,
            participantName,
            scheduledAt: session.scheduledAt,
            livekitStartedAt: session.livekitStartedAt,
            expiresAt,
            ...(transcriptionToken ? { transcriptionToken } : {}),
        });
    }
    catch (error) {
        console.error("[getVideoToken] Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getVideoToken = getVideoToken;
/**
 * GET /api/sessions/:id/livekit/status
 * Coach or Member: Retrieve status mapping of the room.
 */
const getVideoStatus = async (req, res) => {
    try {
        await (0, sessionAutoCompleter_1.checkAndCompleteActiveSessions)();
        const authContext = await getValidatedSession(req, res);
        if (!authContext)
            return;
        const { session } = authContext;
        return res.status(200).json({
            sessionId: session.id,
            coachId: session.coachId,
            memberId: session.memberId,
            roomName: session.livekitRoomName,
            livekitStartedAt: session.livekitStartedAt,
            livekitEndedAt: session.livekitEndedAt,
            status: session.status,
        });
    }
    catch (error) {
        console.error("[getVideoStatus] Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getVideoStatus = getVideoStatus;
/**
 * POST /api/sessions/:id/livekit/end
 * Coach only: Ends the video session, updates end timestamp.
 */
const endVideoSession = async (req, res) => {
    try {
        const authContext = await getValidatedSession(req, res);
        if (!authContext)
            return;
        const { session, isCoach } = authContext;
        if (!isCoach) {
            return res.status(403).json({ message: "Forbidden: Only the assigned coach can end the call" });
        }
        const updatedSession = await prisma_1.default.session.update({
            where: { id: session.id },
            data: {
                livekitEndedAt: new Date(),
                status: "completed",
            },
        });
        return res.status(200).json({
            sessionId: updatedSession.id,
            coachId: updatedSession.coachId,
            memberId: updatedSession.memberId,
            roomName: updatedSession.livekitRoomName,
            livekitStartedAt: updatedSession.livekitStartedAt,
            livekitEndedAt: updatedSession.livekitEndedAt,
            status: updatedSession.status,
        });
    }
    catch (error) {
        console.error("[endVideoSession] Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.endVideoSession = endVideoSession;
