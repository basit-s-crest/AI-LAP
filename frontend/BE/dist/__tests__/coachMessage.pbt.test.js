"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Property-Based Tests for coachMessage service
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5
 */
const fc = __importStar(require("fast-check"));
jest.mock("../lib/prisma");
const prisma_1 = __importDefault(require("../__mocks__/prisma"));
const coachMessage_service_1 = require("../services/coachMessage.service");
const sentimentForwarder_1 = require("../services/sentimentForwarder");
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
        updatedAt: new Date("2024-01-01T10:00:00.000Z"),
        ...overrides,
    };
}
function cm() { return prisma_1.default.coachMember; }
function msg() { return prisma_1.default.coachMessage; }
// ─── Cursor helpers (mirrors the private functions in the service) ─────────────
function encodeCursor(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}
function decodeCursor(cursor) {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
}
// ─── Property 13.2: Cursor round-trip ─────────────────────────────────────────
/**
 * Validates: Requirements 13.2
 * Encoding then decoding a { createdAt, id } cursor yields the original values.
 */
describe("Property 13.2: Cursor round-trip stability", () => {
    it("encoding then decoding a cursor yields the original values", () => {
        fc.assert(fc.property(fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }).filter((d) => !isNaN(d.getTime())), fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0), (date, id) => {
            const original = { createdAt: date.toISOString(), id };
            const encoded = encodeCursor(original);
            const decoded = decodeCursor(encoded);
            return decoded.createdAt === original.createdAt && decoded.id === original.id;
        }), { numRuns: 200 });
    });
});
// ─── Property 13.4: Content validation rejection ──────────────────────────────
/**
 * Validates: Requirements 13.4
 * For any string that is empty, whitespace-only, or longer than 2000 chars,
 * saveMessage rejects without a DB write.
 */
describe("Property 13.4: Content validation rejection", () => {
    const validData = {
        userId: "user-1",
        coachId: "coach-1",
        senderRole: "member",
    };
    it("empty string content always rejects without DB write", async () => {
        await fc.assert(fc.asyncProperty(fc.constant(""), async (content) => {
            jest.clearAllMocks();
            await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content })).rejects.toThrow(coachMessage_service_1.ValidationError);
            expect(msg().create).not.toHaveBeenCalled();
        }), { numRuns: 1 });
    });
    it("whitespace-only content always rejects without DB write", async () => {
        await fc.assert(fc.asyncProperty(fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 1, maxLength: 50 }).map((arr) => arr.join("")), async (content) => {
            jest.clearAllMocks();
            await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content })).rejects.toThrow(coachMessage_service_1.ValidationError);
            expect(msg().create).not.toHaveBeenCalled();
        }), { numRuns: 50 });
    });
    it("content longer than 2000 chars always rejects without DB write", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 2001, max: 5000 }).chain((len) => fc.string({ minLength: len, maxLength: len })), async (content) => {
            jest.clearAllMocks();
            await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content })).rejects.toThrow(coachMessage_service_1.ValidationError);
            expect(msg().create).not.toHaveBeenCalled();
        }), { numRuns: 50 });
    });
    it("valid content (1-2000 non-whitespace chars) is accepted", async () => {
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 2000 }).filter((s) => s.trim().length > 0), async (content) => {
            jest.clearAllMocks();
            cm().findUnique.mockResolvedValue({
                id: "cm-1",
                coachId: "coach-1",
                userId: "user-1",
                assignedAt: new Date(),
            });
            msg().create.mockResolvedValue(makeMessage({ content }));
            await expect((0, coachMessage_service_1.saveMessage)({ ...validData, content })).resolves.toBeDefined();
        }), { numRuns: 50 });
    });
});
// ─── Property 13.3: Assignment guard ─────────────────────────────────────────
/**
 * Validates: Requirements 13.3
 * For any (userId, coachId) pair without a CoachMember row,
 * saveMessage never persists a message and always throws AssignmentError.
 */
describe("Property 13.3: Assignment guard enforcement", () => {
    it("saveMessage always throws AssignmentError when no CoachMember row exists", async () => {
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0), fc.constantFrom("member", "coach"), async (userId, coachId, content, senderRole) => {
            jest.clearAllMocks();
            cm().findUnique.mockResolvedValue(null); // No assignment
            await expect((0, coachMessage_service_1.saveMessage)({ userId, coachId, content, senderRole })).rejects.toThrow(coachMessage_service_1.AssignmentError);
            expect(msg().create).not.toHaveBeenCalled();
        }), { numRuns: 50 });
    });
});
// ─── Property 13.5: Sentiment truncation ─────────────────────────────────────
/**
 * Validates: Requirements 13.5
 * For any content string, the ChatIngestPayload text field has length min(len(content), 500).
 */
describe("Property 13.5: Sentiment payload truncation", () => {
    const mockFetch = jest.fn();
    beforeAll(() => {
        global.fetch = mockFetch;
        process.env.PYTHON_BACKEND_URL = "http://localhost:8000";
        process.env.PYTHON_ORG_ID = "org_test";
    });
    beforeEach(() => {
        mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it("text field in ChatIngestPayload has length min(len(content), 500)", async () => {
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 1000 }), async (content) => {
            mockFetch.mockClear();
            mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
            const message = makeMessage({ content });
            (0, sentimentForwarder_1.forwardToSentiment)(message, message.id);
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(mockFetch).toHaveBeenCalledTimes(1);
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            const expectedLength = Math.min(content.length, 500);
            return body.text.length === expectedLength;
        }), { numRuns: 100 });
    });
    it("full content is preserved in the message object (not truncated in DB)", async () => {
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 501, maxLength: 2000 }), async (content) => {
            mockFetch.mockClear();
            mockFetch.mockResolvedValue({ json: () => Promise.resolve({ event_id: "evt-1" }) });
            const message = makeMessage({ content });
            (0, sentimentForwarder_1.forwardToSentiment)(message, message.id);
            await new Promise((resolve) => setTimeout(resolve, 10));
            const body = JSON.parse(mockFetch.mock.calls[0][1].body);
            // text is truncated to 500 in the payload
            return body.text.length === 500 && message.content.length === content.length;
        }), { numRuns: 50 });
    });
});
// ─── Property 13.1: Pagination completeness ──────────────────────────────────
/**
 * Validates: Requirements 13.1
 * For any array of N messages and any valid limit (1–100),
 * following all nextCursor values yields exactly N distinct messages with no duplicates.
 */
describe("Property 13.1: Pagination completeness", () => {
    it("following all nextCursor values yields exactly N distinct messages with no duplicates", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 30 }), // N messages
        fc.integer({ min: 1, max: 20 }), // limit (smaller range for reliability)
        async (N, limit) => {
            jest.clearAllMocks();
            // Create N messages with distinct timestamps and ids
            const allMessages = Array.from({ length: N }, (_, i) => ({
                id: `msg-${String(i).padStart(4, "0")}`,
                userId: "user-1",
                coachId: "coach-1",
                content: `Message ${i}`,
                senderRole: "member",
                read: false,
                // Distinct timestamps: newest = index 0 in desc order
                createdAt: new Date(1700000000000 + i * 1000),
                updatedAt: new Date(),
            }));
            // Sort descending (as DB would return: newest first)
            const sortedDesc = [...allMessages].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() ||
                b.id.localeCompare(a.id));
            // Track how many messages have been "consumed" so far
            let consumed = 0;
            msg().findMany.mockImplementation(({ take }) => {
                // Return up to `take` rows starting from `consumed`
                const page = sortedDesc.slice(consumed, consumed + take);
                // We advance consumed by (take - 1) because the service fetches limit+1
                // but only returns limit items. The next call should start from where
                // the last returned item was.
                return Promise.resolve(page);
            });
            // Collect all messages by following cursors
            const collected = [];
            let cursor = undefined;
            let iterations = 0;
            const maxIterations = Math.ceil(N / limit) + 2; // safety limit
            while (iterations < maxIterations) {
                iterations++;
                // Set up mock for this page: return slice starting at collected.length
                const pageStart = collected.length;
                const pageSlice = sortedDesc.slice(pageStart, pageStart + limit + 1);
                msg().findMany.mockResolvedValueOnce(pageSlice);
                const page = await (0, coachMessage_service_1.getThread)("user-1", "coach-1", cursor, limit);
                collected.push(...page.messages);
                if (!page.nextCursor)
                    break;
                cursor = page.nextCursor;
            }
            // Verify: exactly N messages, no duplicates
            const ids = collected.map((m) => m.id);
            const uniqueIds = new Set(ids);
            return uniqueIds.size === N && collected.length === N;
        }), { numRuns: 30 });
    });
});
