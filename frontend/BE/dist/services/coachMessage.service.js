"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignmentError = exports.ValidationError = void 0;
exports.toCoachMessageDTO = toCoachMessageDTO;
exports.saveMessage = saveMessage;
exports.getThread = getThread;
exports.markRead = markRead;
exports.getConversationList = getConversationList;
const prisma_1 = __importDefault(require("../lib/prisma"));
// ─── Error Classes ────────────────────────────────────────────────────────────
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
class AssignmentError extends Error {
    constructor(message) {
        super(message);
        this.name = "AssignmentError";
    }
}
exports.AssignmentError = AssignmentError;
function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
function decodeCursor(cursor) {
    const json = Buffer.from(cursor, "base64").toString("utf-8");
    return JSON.parse(json);
}
// ─── DTO Mapper ───────────────────────────────────────────────────────────────
function toCoachMessageDTO(msg) {
    return {
        id: msg.id,
        userId: msg.userId,
        coachId: msg.coachId,
        content: msg.content,
        senderRole: msg.senderRole,
        read: msg.read,
        createdAt: msg.createdAt.toISOString(),
    };
}
// ─── Service Methods ──────────────────────────────────────────────────────────
/**
 * Validates content and senderRole, verifies the CoachMember assignment exists,
 * then persists the message with read: false.
 */
async function saveMessage(data) {
    // Validate content
    const trimmed = data.content.trim();
    if (!trimmed) {
        throw new ValidationError("Message content must not be empty.");
    }
    if (data.content.length > 2000) {
        throw new ValidationError("Message content must not exceed 2000 characters.");
    }
    // Validate senderRole
    if (data.senderRole !== "member" && data.senderRole !== "coach") {
        throw new ValidationError('senderRole must be "member" or "coach".');
    }
    // Verify CoachMember assignment exists
    const assignment = await prisma_1.default.coachMember.findUnique({
        where: {
            coachId_userId: {
                coachId: data.coachId,
                userId: data.userId,
            },
        },
    });
    if (!assignment) {
        throw new AssignmentError(`No CoachMember assignment found for coachId=${data.coachId} and userId=${data.userId}.`);
    }
    // Persist the message
    return prisma_1.default.coachMessage.create({
        data: {
            userId: data.userId,
            coachId: data.coachId,
            content: data.content,
            senderRole: data.senderRole,
            read: false,
        },
    });
}
/**
 * Cursor-based pagination for a thread.
 * Returns messages in ascending chronological order (oldest first).
 *
 * Cursor encodes { createdAt: ISO string, id: string }.
 * Fetches limit+1 rows ordered by (createdAt desc, id desc), then reverses.
 */
async function getThread(userId, coachId, cursor, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where = { userId, coachId };
    if (cursor) {
        const decoded = decodeCursor(cursor);
        // Fetch rows older than the cursor position:
        // (createdAt < cursor.createdAt) OR (createdAt = cursor.createdAt AND id < cursor.id)
        where.OR = [
            { createdAt: { lt: new Date(decoded.createdAt) } },
            {
                createdAt: { equals: new Date(decoded.createdAt) },
                id: { lt: decoded.id },
            },
        ];
    }
    const rows = await prisma_1.default.coachMessage.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: safeLimit + 1,
    });
    const hasMore = rows.length > safeLimit;
    let nextCursor = null;
    if (hasMore) {
        // The (limit)th item (0-indexed: safeLimit - 1) is the last one we return.
        // The extra item at index safeLimit tells us there's more.
        const lastReturned = rows[safeLimit - 1];
        nextCursor = encodeCursor({
            createdAt: lastReturned.createdAt.toISOString(),
            id: lastReturned.id,
        });
    }
    // Slice to limit, then reverse to get ascending chronological order
    const sliced = rows.slice(0, safeLimit);
    const messages = sliced.reverse();
    return { messages, nextCursor };
}
/**
 * Marks unread messages as read for the authenticated user (as receiver).
 *
 * - member reader: marks messages sent by coach (senderRole = "coach") as read
 * - coach reader:  marks messages sent by member (senderRole = "member") as read
 *
 * Returns the count of updated rows.
 */
async function markRead(readerUserId, readerRole, partnerId) {
    let result;
    if (readerRole === "member") {
        // Reader is the member; receiver of coach-sent messages
        result = await prisma_1.default.coachMessage.updateMany({
            where: {
                userId: readerUserId,
                coachId: partnerId,
                read: false,
                senderRole: "coach",
            },
            data: { read: true },
        });
    }
    else {
        // Reader is the coach; receiver of member-sent messages
        result = await prisma_1.default.coachMessage.updateMany({
            where: {
                coachId: readerUserId,
                userId: partnerId,
                read: false,
                senderRole: "member",
            },
            data: { read: true },
        });
    }
    return result.count;
}
/**
 * Returns a ConversationSummary[] for all threads of the caller.
 *
 * - member: finds all distinct coachIds, joins Coach for name/avatar
 * - coach:  finds all distinct userIds, joins User for name/avatar
 */
async function getConversationList(id, role) {
    if (role === "member") {
        // Find all distinct coachIds for this member
        const distinctCoachIds = await prisma_1.default.coachMessage.findMany({
            where: { userId: id },
            select: { coachId: true },
            distinct: ["coachId"],
        });
        const summaries = [];
        for (const { coachId } of distinctCoachIds) {
            // Fetch coach info
            const coach = await prisma_1.default.coach.findUnique({
                where: { id: coachId },
                select: { id: true, name: true, avatar: true },
            });
            if (!coach)
                continue;
            // Get last message
            const lastMsg = await prisma_1.default.coachMessage.findFirst({
                where: { userId: id, coachId },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: { content: true, createdAt: true },
            });
            if (!lastMsg)
                continue;
            // Count unread messages where member is the receiver (sent by coach)
            const unreadCount = await prisma_1.default.coachMessage.count({
                where: {
                    userId: id,
                    coachId,
                    read: false,
                    senderRole: "coach",
                },
            });
            summaries.push({
                partnerId: coach.id,
                partnerName: coach.name,
                partnerAvatar: coach.avatar ?? null,
                lastMessage: lastMsg.content,
                lastMessageAt: lastMsg.createdAt,
                unreadCount,
            });
        }
        return summaries;
    }
    else {
        // role === "coach"
        // Find all distinct userIds for this coach
        const distinctUserIds = await prisma_1.default.coachMessage.findMany({
            where: { coachId: id },
            select: { userId: true },
            distinct: ["userId"],
        });
        const summaries = [];
        for (const { userId } of distinctUserIds) {
            // Fetch user info
            const user = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { id: true, name: true, avatar: true },
            });
            if (!user)
                continue;
            // Get last message
            const lastMsg = await prisma_1.default.coachMessage.findFirst({
                where: { coachId: id, userId },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                select: { content: true, createdAt: true },
            });
            if (!lastMsg)
                continue;
            // Count unread messages where coach is the receiver (sent by member)
            const unreadCount = await prisma_1.default.coachMessage.count({
                where: {
                    coachId: id,
                    userId,
                    read: false,
                    senderRole: "member",
                },
            });
            summaries.push({
                partnerId: user.id,
                partnerName: user.name,
                partnerAvatar: user.avatar ?? null,
                lastMessage: lastMsg.content,
                lastMessageAt: lastMsg.createdAt,
                unreadCount,
            });
        }
        return summaries;
    }
}
