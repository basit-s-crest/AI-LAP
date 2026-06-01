"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../__mocks__/prisma"));
const coachMessage_service_1 = require("../services/coachMessage.service");
jest.mock("../lib/prisma");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeMessage(overrides = {}) {
    return {
        id: "msg-1",
        userId: "user-1",
        coachId: "coach-1",
        content: "Hello",
        senderRole: "member",
        read: false,
        createdAt: new Date("2024-01-01T10:00:00.000Z"),
        ...overrides,
    };
}
function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
// Shorthand accessors — accessed inside tests so they reflect the live mock state
function cm() { return prisma_1.default.coachMember; }
function msg() { return prisma_1.default.coachMessage; }
function coach() { return prisma_1.default.coach; }
function user() { return prisma_1.default.user; }
// ─── saveMessage ──────────────────────────────────────────────────────────────
describe("saveMessage", () => {
    const validData = {
        userId: "user-1",
        coachId: "coach-1",
        content: "Hello coach!",
        senderRole: "member",
    };
    it("should persist message with correct fields and read: false", async () => {
        const expectedMsg = makeMessage({ content: "Hello coach!", senderRole: "member" });
        cm().findUnique.mockResolvedValue({
            id: "cm-1",
            coachId: "coach-1",
            userId: "user-1",
            assignedAt: new Date(),
        });
        msg().create.mockResolvedValue(expectedMsg);
        const result = await (0, coachMessage_service_1.saveMessage)(validData);
        expect(msg().create).toHaveBeenCalledWith({
            data: {
                userId: "user-1",
                coachId: "coach-1",
                content: "Hello coach!",
                senderRole: "member",
                read: false,
            },
        });
        expect(result.read).toBe(false);
        expect(result.content).toBe("Hello coach!");
        expect(result.senderRole).toBe("member");
    });
    it("should persist message with senderRole: coach", async () => {
        const coachData = { ...validData, senderRole: "coach" };
        const expectedMsg = makeMessage({ senderRole: "coach" });
        cm().findUnique.mockResolvedValue({
            id: "cm-1",
            coachId: "coach-1",
            userId: "user-1",
            assignedAt: new Date(),
        });
        msg().create.mockResolvedValue(expectedMsg);
        await (0, coachMessage_service_1.saveMessage)(coachData);
        expect(msg().create).toHaveBeenCalledWith({
            data: expect.objectContaining({ senderRole: "coach", read: false }),
        });
    });
    it("should throw ValidationError when content is empty string", async () => {
        await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content: "" })).rejects.toThrow(coachMessage_service_1.ValidationError);
        expect(msg().create).not.toHaveBeenCalled();
    });
    it("should throw ValidationError when content is whitespace-only", async () => {
        await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content: "   " })).rejects.toThrow(coachMessage_service_1.ValidationError);
        expect(msg().create).not.toHaveBeenCalled();
    });
    it("should throw ValidationError when content exceeds 2000 chars", async () => {
        const longContent = "a".repeat(2001);
        await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content: longContent })).rejects.toThrow(coachMessage_service_1.ValidationError);
        expect(msg().create).not.toHaveBeenCalled();
    });
    it("should accept content of exactly 2000 chars", async () => {
        const exactContent = "a".repeat(2000);
        cm().findUnique.mockResolvedValue({
            id: "cm-1",
            coachId: "coach-1",
            userId: "user-1",
            assignedAt: new Date(),
        });
        msg().create.mockResolvedValue(makeMessage({ content: exactContent }));
        await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content: exactContent })).resolves.toBeDefined();
    });
    it("should throw ValidationError when senderRole is invalid", async () => {
        await expect((0, coachMessage_service_1.saveMessage)({ ...validData, senderRole: "admin" })).rejects.toThrow(coachMessage_service_1.ValidationError);
        expect(msg().create).not.toHaveBeenCalled();
    });
    it("should throw AssignmentError when no CoachMember row exists", async () => {
        cm().findUnique.mockResolvedValue(null);
        await expect((0, coachMessage_service_1.saveMessage)(validData)).rejects.toThrow(coachMessage_service_1.AssignmentError);
        expect(msg().create).not.toHaveBeenCalled();
    });
    it("should verify CoachMember with correct coachId_userId composite key", async () => {
        cm().findUnique.mockResolvedValue(null);
        await expect((0, coachMessage_service_1.saveMessage)(validData)).rejects.toThrow(coachMessage_service_1.AssignmentError);
        expect(cm().findUnique).toHaveBeenCalledWith({
            where: {
                coachId_userId: {
                    coachId: "coach-1",
                    userId: "user-1",
                },
            },
        });
    });
});
// ─── markRead ─────────────────────────────────────────────────────────────────
describe("markRead", () => {
    it("member reader: should update messages where userId=readerUserId, coachId=partnerId, senderRole=coach, read=false", async () => {
        msg().updateMany.mockResolvedValue({ count: 3 });
        const count = await (0, coachMessage_service_1.markRead)("user-1", "member", "coach-1");
        expect(msg().updateMany).toHaveBeenCalledWith({
            where: {
                userId: "user-1",
                coachId: "coach-1",
                read: false,
                senderRole: "coach",
            },
            data: { read: true },
        });
        expect(count).toBe(3);
    });
    it("coach reader: should update messages where coachId=readerUserId, userId=partnerId, senderRole=member, read=false", async () => {
        msg().updateMany.mockResolvedValue({ count: 5 });
        const count = await (0, coachMessage_service_1.markRead)("coach-1", "coach", "user-1");
        expect(msg().updateMany).toHaveBeenCalledWith({
            where: {
                coachId: "coach-1",
                userId: "user-1",
                read: false,
                senderRole: "member",
            },
            data: { read: true },
        });
        expect(count).toBe(5);
    });
    it("should return the count of updated rows", async () => {
        msg().updateMany.mockResolvedValue({ count: 7 });
        const count = await (0, coachMessage_service_1.markRead)("user-1", "member", "coach-1");
        expect(count).toBe(7);
    });
    it("should return 0 when no messages were updated", async () => {
        msg().updateMany.mockResolvedValue({ count: 0 });
        const count = await (0, coachMessage_service_1.markRead)("user-1", "member", "coach-1");
        expect(count).toBe(0);
    });
    it("member reader: should NOT touch messages where senderRole=member (sender's own messages)", async () => {
        msg().updateMany.mockResolvedValue({ count: 0 });
        await (0, coachMessage_service_1.markRead)("user-1", "member", "coach-1");
        const callArgs = msg().updateMany.mock.calls[0][0];
        expect(callArgs.where.senderRole).toBe("coach");
    });
    it("coach reader: should NOT touch messages where senderRole=coach (sender's own messages)", async () => {
        msg().updateMany.mockResolvedValue({ count: 0 });
        await (0, coachMessage_service_1.markRead)("coach-1", "coach", "user-1");
        const callArgs = msg().updateMany.mock.calls[0][0];
        expect(callArgs.where.senderRole).toBe("member");
    });
});
// ─── getThread ────────────────────────────────────────────────────────────────
describe("getThread", () => {
    const userId = "user-1";
    const coachId = "coach-1";
    it("without cursor: should query with just { userId, coachId } where clause", async () => {
        msg().findMany.mockResolvedValue([]);
        await (0, coachMessage_service_1.getThread)(userId, coachId);
        const callArgs = msg().findMany.mock.calls[0][0];
        expect(callArgs.where).toEqual({ userId, coachId });
        expect(callArgs.where.OR).toBeUndefined();
    });
    it("with cursor: should include OR clause for pagination", async () => {
        const cursorDate = new Date("2024-01-01T10:00:00.000Z");
        const cursor = encodeCursor({ createdAt: cursorDate.toISOString(), id: "msg-5" });
        msg().findMany.mockResolvedValue([]);
        await (0, coachMessage_service_1.getThread)(userId, coachId, cursor);
        const callArgs = msg().findMany.mock.calls[0][0];
        expect(callArgs.where.OR).toBeDefined();
        expect(callArgs.where.OR).toHaveLength(2);
        expect(callArgs.where.OR[0]).toEqual({ createdAt: { lt: cursorDate } });
        expect(callArgs.where.OR[1]).toEqual({
            createdAt: { equals: cursorDate },
            id: { lt: "msg-5" },
        });
    });
    it("should query with orderBy: [createdAt desc, id desc]", async () => {
        msg().findMany.mockResolvedValue([]);
        await (0, coachMessage_service_1.getThread)(userId, coachId);
        const callArgs = msg().findMany.mock.calls[0][0];
        expect(callArgs.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    });
    it("should return messages in ascending order (reversed from DB desc order)", async () => {
        const msg1 = makeMessage({ id: "msg-1", createdAt: new Date("2024-01-01T08:00:00.000Z") });
        const msg2 = makeMessage({ id: "msg-2", createdAt: new Date("2024-01-01T09:00:00.000Z") });
        const msg3 = makeMessage({ id: "msg-3", createdAt: new Date("2024-01-01T10:00:00.000Z") });
        // DB returns desc order (newest first)
        msg().findMany.mockResolvedValue([msg3, msg2, msg1]);
        const result = await (0, coachMessage_service_1.getThread)(userId, coachId, undefined, 10);
        // Should be reversed to ascending (oldest first)
        expect(result.messages[0].id).toBe("msg-1");
        expect(result.messages[1].id).toBe("msg-2");
        expect(result.messages[2].id).toBe("msg-3");
    });
    it("should set nextCursor when more rows exist (limit+1 rows returned)", async () => {
        const limit = 3;
        const msgs = [
            makeMessage({ id: "msg-4", createdAt: new Date("2024-01-01T10:04:00.000Z") }),
            makeMessage({ id: "msg-3", createdAt: new Date("2024-01-01T10:03:00.000Z") }),
            makeMessage({ id: "msg-2", createdAt: new Date("2024-01-01T10:02:00.000Z") }),
            makeMessage({ id: "msg-1", createdAt: new Date("2024-01-01T10:01:00.000Z") }), // extra row
        ];
        msg().findMany.mockResolvedValue(msgs);
        const result = await (0, coachMessage_service_1.getThread)(userId, coachId, undefined, limit);
        expect(result.nextCursor).not.toBeNull();
        expect(result.messages).toHaveLength(limit);
    });
    it("should set nextCursor to null when no more rows exist", async () => {
        const limit = 5;
        const msgs = [
            makeMessage({ id: "msg-2", createdAt: new Date("2024-01-01T10:02:00.000Z") }),
            makeMessage({ id: "msg-1", createdAt: new Date("2024-01-01T10:01:00.000Z") }),
        ];
        msg().findMany.mockResolvedValue(msgs);
        const result = await (0, coachMessage_service_1.getThread)(userId, coachId, undefined, limit);
        expect(result.nextCursor).toBeNull();
        expect(result.messages).toHaveLength(2);
    });
    it("nextCursor should encode the last returned message's createdAt and id", async () => {
        const limit = 2;
        const msgs = [
            makeMessage({ id: "msg-3", createdAt: new Date("2024-01-01T10:03:00.000Z") }),
            makeMessage({ id: "msg-2", createdAt: new Date("2024-01-01T10:02:00.000Z") }),
            makeMessage({ id: "msg-1", createdAt: new Date("2024-01-01T10:01:00.000Z") }), // extra
        ];
        msg().findMany.mockResolvedValue(msgs);
        const result = await (0, coachMessage_service_1.getThread)(userId, coachId, undefined, limit);
        expect(result.nextCursor).not.toBeNull();
        const decoded = JSON.parse(Buffer.from(result.nextCursor, "base64").toString("utf-8"));
        // The last returned message (index limit-1 = 1) is msg-2
        expect(decoded.id).toBe("msg-2");
        expect(decoded.createdAt).toBe(new Date("2024-01-01T10:02:00.000Z").toISOString());
    });
    it("should return empty messages array when no messages exist", async () => {
        msg().findMany.mockResolvedValue([]);
        const result = await (0, coachMessage_service_1.getThread)(userId, coachId);
        expect(result.messages).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });
});
// ─── getConversationList ──────────────────────────────────────────────────────
describe("getConversationList", () => {
    it("for member role: should return summaries with coach as partner", async () => {
        const memberId = "user-1";
        msg().findMany.mockResolvedValue([{ coachId: "coach-1" }]);
        coach().findUnique.mockResolvedValue({
            id: "coach-1",
            name: "Coach Alice",
            avatar: "https://example.com/alice.jpg",
            email: "alice@example.com",
            password: "hashed",
            bio: null,
            speciality: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        msg().findFirst.mockResolvedValue(makeMessage({ content: "Last message", createdAt: new Date("2024-01-02T10:00:00.000Z") }));
        msg().count.mockResolvedValue(2);
        const summaries = await (0, coachMessage_service_1.getConversationList)(memberId, "member");
        expect(summaries).toHaveLength(1);
        const summary = summaries[0];
        expect(summary.partnerId).toBe("coach-1");
        expect(summary.partnerName).toBe("Coach Alice");
        expect(summary.partnerAvatar).toBe("https://example.com/alice.jpg");
        expect(summary.lastMessage).toBe("Last message");
        expect(summary.lastMessageAt).toEqual(new Date("2024-01-02T10:00:00.000Z"));
        expect(summary.unreadCount).toBe(2);
    });
    it("for coach role: should return summaries with user as partner", async () => {
        const coachId = "coach-1";
        msg().findMany.mockResolvedValue([{ userId: "user-1" }]);
        user().findUnique.mockResolvedValue({
            id: "user-1",
            name: "Member Bob",
            avatar: null,
            email: "bob@example.com",
            password: "hashed",
            role: "member",
            isVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        msg().findFirst.mockResolvedValue(makeMessage({ content: "Hi coach", createdAt: new Date("2024-01-03T10:00:00.000Z") }));
        msg().count.mockResolvedValue(4);
        const summaries = await (0, coachMessage_service_1.getConversationList)(coachId, "coach");
        expect(summaries).toHaveLength(1);
        const summary = summaries[0];
        expect(summary.partnerId).toBe("user-1");
        expect(summary.partnerName).toBe("Member Bob");
        expect(summary.partnerAvatar).toBeNull();
        expect(summary.lastMessage).toBe("Hi coach");
        expect(summary.unreadCount).toBe(4);
    });
    it("each summary should have all required ConversationSummary fields", async () => {
        msg().findMany.mockResolvedValue([{ coachId: "coach-1" }]);
        coach().findUnique.mockResolvedValue({
            id: "coach-1",
            name: "Coach Alice",
            avatar: null,
            email: "alice@example.com",
            password: "hashed",
            bio: null,
            speciality: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        msg().findFirst.mockResolvedValue(makeMessage({ content: "Test", createdAt: new Date() }));
        msg().count.mockResolvedValue(0);
        const summaries = await (0, coachMessage_service_1.getConversationList)("user-1", "member");
        expect(summaries).toHaveLength(1);
        const summary = summaries[0];
        expect(summary).toHaveProperty("partnerId");
        expect(summary).toHaveProperty("partnerName");
        expect(summary).toHaveProperty("partnerAvatar");
        expect(summary).toHaveProperty("lastMessage");
        expect(summary).toHaveProperty("lastMessageAt");
        expect(summary).toHaveProperty("unreadCount");
    });
    it("for member role: unread count should count messages where senderRole=coach and read=false", async () => {
        const memberId = "user-1";
        msg().findMany.mockResolvedValue([{ coachId: "coach-1" }]);
        coach().findUnique.mockResolvedValue({
            id: "coach-1",
            name: "Coach Alice",
            avatar: null,
            email: "alice@example.com",
            password: "hashed",
            bio: null,
            speciality: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        msg().findFirst.mockResolvedValue(makeMessage({ content: "Test" }));
        msg().count.mockResolvedValue(3);
        await (0, coachMessage_service_1.getConversationList)(memberId, "member");
        expect(msg().count).toHaveBeenCalledWith({
            where: {
                userId: memberId,
                coachId: "coach-1",
                read: false,
                senderRole: "coach",
            },
        });
    });
    it("for coach role: unread count should count messages where senderRole=member and read=false", async () => {
        const coachId = "coach-1";
        msg().findMany.mockResolvedValue([{ userId: "user-1" }]);
        user().findUnique.mockResolvedValue({
            id: "user-1",
            name: "Member Bob",
            avatar: null,
            email: "bob@example.com",
            password: "hashed",
            role: "member",
            isVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        msg().findFirst.mockResolvedValue(makeMessage({ content: "Test" }));
        msg().count.mockResolvedValue(1);
        await (0, coachMessage_service_1.getConversationList)(coachId, "coach");
        expect(msg().count).toHaveBeenCalledWith({
            where: {
                coachId: coachId,
                userId: "user-1",
                read: false,
                senderRole: "member",
            },
        });
    });
    it("should return empty array when no conversations exist", async () => {
        msg().findMany.mockResolvedValue([]);
        const summaries = await (0, coachMessage_service_1.getConversationList)("user-1", "member");
        expect(summaries).toEqual([]);
    });
    it("should skip conversations where coach/user is not found", async () => {
        msg().findMany.mockResolvedValue([{ coachId: "coach-ghost" }]);
        coach().findUnique.mockResolvedValue(null);
        const summaries = await (0, coachMessage_service_1.getConversationList)("user-1", "member");
        expect(summaries).toEqual([]);
    });
    it("should handle multiple conversations", async () => {
        msg().findMany.mockResolvedValue([
            { coachId: "coach-1" },
            { coachId: "coach-2" },
        ]);
        coach().findUnique
            .mockResolvedValueOnce({
            id: "coach-1",
            name: "Coach Alice",
            avatar: null,
            email: "alice@example.com",
            password: "hashed",
            bio: null,
            speciality: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
            .mockResolvedValueOnce({
            id: "coach-2",
            name: "Coach Bob",
            avatar: null,
            email: "bob@example.com",
            password: "hashed",
            bio: null,
            speciality: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        msg().findFirst
            .mockResolvedValueOnce(makeMessage({ coachId: "coach-1", content: "Msg from Alice" }))
            .mockResolvedValueOnce(makeMessage({ coachId: "coach-2", content: "Msg from Bob" }));
        msg().count.mockResolvedValue(0);
        const summaries = await (0, coachMessage_service_1.getConversationList)("user-1", "member");
        expect(summaries).toHaveLength(2);
        expect(summaries[0].partnerId).toBe("coach-1");
        expect(summaries[1].partnerId).toBe("coach-2");
    });
});
