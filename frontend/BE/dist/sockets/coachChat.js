"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCoachChatHandlers = registerCoachChatHandlers;
const prisma_1 = __importDefault(require("../lib/prisma"));
const coachMessage_service_1 = require("../services/coachMessage.service");
const sentimentForwarder_1 = require("../services/sentimentForwarder");
function registerCoachChatHandlers(io, socket) {
    const user = socket.data.user;
    // Join personal room on connection
    const personalRoom = user.role === "member" ? `user:${user.id}` : `coach:${user.id}`;
    socket.join(personalRoom);
    // 4.5 — join_thread (idempotent — already in personal room)
    socket.on("join_thread", (_data) => {
        socket.join(personalRoom);
    });
    // 4.6 — send_message
    socket.on("send_message", async (data) => {
        try {
            const userId = user.role === "member" ? user.id : data.partnerId;
            const coachId = user.role === "coach" ? user.id : data.partnerId;
            // Assignment guard — also enforced inside saveMessage, but check here for early error emit
            const assignment = await prisma_1.default.coachMember.findUnique({
                where: { coachId_userId: { coachId, userId } },
            });
            if (!assignment) {
                socket.emit("error", {
                    code: "UNAUTHORIZED_THREAD",
                    message: "No assignment found",
                });
                return;
            }
            const message = await (0, coachMessage_service_1.saveMessage)({
                userId,
                coachId,
                content: data.content,
                senderRole: user.role,
            });
            const dto = (0, coachMessage_service_1.toCoachMessageDTO)(message);
            // Acknowledge sender
            socket.emit("message_saved", dto);
            // Deliver to partner's personal room
            const partnerRoom = user.role === "member" ? `coach:${coachId}` : `user:${userId}`;
            io.of("/coach-chat").to(partnerRoom).emit("new_message", dto);
            // Sentiment — member messages only
            if (user.role === "member") {
                (0, sentimentForwarder_1.forwardToSentiment)(message);
            }
        }
        catch (err) {
            if (err instanceof coachMessage_service_1.ValidationError || err instanceof coachMessage_service_1.AssignmentError) {
                socket.emit("error", {
                    code: err instanceof coachMessage_service_1.AssignmentError ? "UNAUTHORIZED_THREAD" : "VALIDATION_ERROR",
                    message: err.message,
                });
            }
            else {
                socket.emit("error", {
                    code: "SAVE_FAILED",
                    message: "Message could not be saved",
                });
            }
        }
    });
    // 4.7 — mark_read
    socket.on("mark_read", async (data) => {
        try {
            await (0, coachMessage_service_1.markRead)(user.id, user.role, data.partnerId);
            const partnerRoom = user.role === "member"
                ? `coach:${data.partnerId}`
                : `user:${data.partnerId}`;
            io.of("/coach-chat").to(partnerRoom).emit("read_receipt", {
                partnerId: user.id,
                readAt: new Date().toISOString(),
            });
        }
        catch {
            // Silently ignore mark_read errors
        }
    });
}
