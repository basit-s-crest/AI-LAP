"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock("../lib/prisma");
const prisma_1 = __importDefault(require("../__mocks__/prisma"));
// Mock LiveKit SDK
jest.mock("livekit-server-sdk", () => {
    return {
        AccessToken: jest.fn().mockImplementation(() => {
            return {
                addGrant: jest.fn(),
                toJwt: jest.fn().mockResolvedValue("mocked_jwt_token"),
            };
        }),
    };
});
const livekit_controller_1 = require("../controllers/livekit.controller");
function makeReq(overrides = {}) {
    return { body: {}, params: {}, query: {}, user: undefined, ...overrides };
}
function makeRes() {
    const json = jest.fn().mockReturnThis();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json };
    return { status, json, res };
}
function sessionMock() {
    return prisma_1.default.session;
}
function coachMock() {
    return prisma_1.default.coach;
}
function userMock() {
    return prisma_1.default.user;
}
describe("LiveKit Controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.LIVEKIT_API_KEY = "test-key";
        process.env.LIVEKIT_API_SECRET = "test-secret";
        process.env.LIVEKIT_URL = "test-url";
    });
    describe("startVideoSession", () => {
        it("starts a session successfully and returns a token", async () => {
            const mockSession = {
                id: "sess-1",
                coachId: "coach-1",
                memberId: "member-1",
                duration: 50,
                status: "upcoming",
                livekitRoomName: null,
                livekitStartedAt: null,
                scheduledAt: new Date(),
            };
            sessionMock().findUnique.mockResolvedValue(mockSession);
            sessionMock().update.mockResolvedValue({
                ...mockSession,
                livekitRoomName: "safecircle-session-sess-1",
                livekitStartedAt: new Date(),
            });
            coachMock().findUnique.mockResolvedValue({ name: "Coach Name" });
            const req = makeReq({
                params: { id: "sess-1" },
                user: { id: "coach-1", role: "coach" },
            });
            const { status, json, res } = makeRes();
            await (0, livekit_controller_1.startVideoSession)(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({
                sessionId: "sess-1",
                token: "mocked_jwt_token",
                role: "coach",
            }));
        });
        it("returns 403 if user is not the assigned coach", async () => {
            const mockSession = {
                id: "sess-1",
                coachId: "coach-1",
                memberId: "member-1",
                status: "upcoming",
            };
            sessionMock().findUnique.mockResolvedValue(mockSession);
            const req = makeReq({
                params: { id: "sess-1" },
                user: { id: "coach-2", role: "coach" },
            });
            const { status, json, res } = makeRes();
            await (0, livekit_controller_1.startVideoSession)(req, res);
            expect(status).toHaveBeenCalledWith(403);
        });
    });
    describe("getVideoToken", () => {
        it("allows assigned member to fetch token if session has started", async () => {
            const mockSession = {
                id: "sess-1",
                coachId: "coach-1",
                memberId: "member-1",
                duration: 50,
                status: "upcoming",
                livekitRoomName: "safecircle-session-sess-1",
                livekitStartedAt: new Date(),
                scheduledAt: new Date(),
            };
            sessionMock().findUnique.mockResolvedValue(mockSession);
            userMock().findUnique.mockResolvedValue({ name: "Member Name" });
            const req = makeReq({
                params: { id: "sess-1" },
                user: { id: "member-1", role: "member" },
            });
            const { status, json, res } = makeRes();
            await (0, livekit_controller_1.getVideoToken)(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({
                role: "user",
                token: "mocked_jwt_token",
            }));
        });
        it("returns 409 if session has not been started yet", async () => {
            const mockSession = {
                id: "sess-1",
                coachId: "coach-1",
                memberId: "member-1",
                status: "upcoming",
                livekitRoomName: null,
                livekitStartedAt: null,
            };
            sessionMock().findUnique.mockResolvedValue(mockSession);
            const req = makeReq({
                params: { id: "sess-1" },
                user: { id: "member-1", role: "member" },
            });
            const { status, json, res } = makeRes();
            await (0, livekit_controller_1.getVideoToken)(req, res);
            expect(status).toHaveBeenCalledWith(409);
        });
    });
    describe("getVideoStatus", () => {
        it("returns video room status to authorized users", async () => {
            const mockSession = {
                id: "sess-1",
                coachId: "coach-1",
                memberId: "member-1",
                duration: 50,
                status: "upcoming",
                livekitRoomName: "safecircle-session-sess-1",
                livekitStartedAt: new Date(),
                livekitEndedAt: null,
            };
            sessionMock().findUnique.mockResolvedValue(mockSession);
            const req = makeReq({
                params: { id: "sess-1" },
                user: { id: "member-1", role: "member" },
            });
            const { status, json, res } = makeRes();
            await (0, livekit_controller_1.getVideoStatus)(req, res);
            expect(status).toHaveBeenCalledWith(200);
            expect(json).toHaveBeenCalledWith(expect.objectContaining({
                sessionId: "sess-1",
                roomName: "safecircle-session-sess-1",
            }));
        });
    });
});
