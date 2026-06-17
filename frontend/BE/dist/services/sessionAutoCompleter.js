"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndCompleteActiveSessions = checkAndCompleteActiveSessions;
exports.startSessionAutoCompleter = startSessionAutoCompleter;
const prisma_1 = __importDefault(require("../lib/prisma"));
const livekit_server_sdk_1 = require("livekit-server-sdk");
const MS_MINUTE = 60 * 1000;
const CHECK_INTERVAL = 15 * MS_MINUTE;
async function checkAndCompleteActiveSessions() {
    const now = new Date();
    try {
        // Find all sessions that have started, but not yet ended/completed/cancelled
        const activeSessions = await prisma_1.default.session.findMany({
            where: {
                status: { in: ["upcoming", "rescheduled"] },
                livekitStartedAt: { not: null },
                livekitEndedAt: null,
            },
        });
        if (activeSessions.length === 0)
            return;
        const apiKey = process.env.LIVEKIT_API_KEY;
        const apiSecret = process.env.LIVEKIT_API_SECRET;
        const serverUrl = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "";
        if (!apiKey || !apiSecret) {
            console.warn("[AutoCompleter] LiveKit credentials not configured. Skipping active session check.");
            return;
        }
        const host = serverUrl.replace("wss://", "https://").replace("ws://", "http://");
        const svc = new livekit_server_sdk_1.RoomServiceClient(host, apiKey, apiSecret);
        for (const session of activeSessions) {
            // Apply a grace period of 2 minutes from start time to allow initial connections
            if (session.livekitStartedAt && now.getTime() - session.livekitStartedAt.getTime() > 120 * 1000) {
                const roomName = session.livekitRoomName || `safecircle-session-${session.id}`;
                try {
                    const participants = await svc.listParticipants(roomName);
                    if (participants.length === 0) {
                        await prisma_1.default.session.update({
                            where: { id: session.id },
                            data: {
                                status: "completed",
                                livekitEndedAt: now,
                            },
                        });
                        console.log(`[AutoCompleter] Active session ${session.id} marked as completed because room is empty.`);
                    }
                }
                catch (roomError) {
                    // If room is not found (404), it means it's not active anymore or empty, so we should also mark it completed
                    if (roomError?.message?.toLowerCase().includes("not found") ||
                        roomError?.status === 404) {
                        await prisma_1.default.session.update({
                            where: { id: session.id },
                            data: {
                                status: "completed",
                                livekitEndedAt: now,
                            },
                        });
                        console.log(`[AutoCompleter] Active session ${session.id} marked as completed because room was not found (ended).`);
                    }
                    else {
                        console.error(`[AutoCompleter] Error listing participants for room ${roomName}:`, roomError);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("[checkAndCompleteActiveSessions] Error:", error);
    }
}
async function checkAndCompleteSessions() {
    const now = new Date();
    try {
        // First check active sessions via LiveKit
        await checkAndCompleteActiveSessions();
        const sessions = await prisma_1.default.session.findMany({
            where: {
                status: { in: ["upcoming", "rescheduled"] },
                scheduledAt: { lt: now },
            },
        });
        const toComplete = sessions.filter((s) => s.scheduledAt.getTime() + s.duration * 60 * 1000 < now.getTime());
        for (const session of toComplete) {
            await prisma_1.default.session.update({
                where: { id: session.id },
                data: { status: "completed" },
            });
            console.log(`[sessionAutoCompleter] Session ${session.id} marked as completed.`);
        }
    }
    catch (err) {
        console.error("[sessionAutoCompleter] Error during auto-completion:", err);
    }
}
function startSessionAutoCompleter() {
    const tick = () => {
        void checkAndCompleteSessions();
    };
    tick();
    setInterval(tick, CHECK_INTERVAL);
    console.log("[sessionAutoCompleter] scheduler started (15-minute check)");
}
