import { Request, Response } from "express";

jest.mock("../lib/prisma");
import prismaMock from "../__mocks__/prisma";

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

import {
  startVideoSession,
  getVideoToken,
  getVideoStatus,
} from "../controllers/livekit.controller";

function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
  return { body: {}, params: {}, query: {}, user: undefined, ...overrides };
}

function makeRes(): { status: jest.Mock; json: jest.Mock; res: any } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as any;
  return { status, json, res };
}

function sessionMock() {
  return (prismaMock as any).session;
}
function coachMock() {
  return (prismaMock as any).coach;
}
function userMock() {
  return (prismaMock as any).user;
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

      await startVideoSession(req as Request<{ id: string }>, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sess-1",
          token: "mocked_jwt_token",
          role: "coach",
        })
      );
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

      await startVideoSession(req as Request<{ id: string }>, res);

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

      await getVideoToken(req as Request<{ id: string }>, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "user",
          token: "mocked_jwt_token",
        })
      );
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

      await getVideoToken(req as Request<{ id: string }>, res);

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

      await getVideoStatus(req as Request<{ id: string }>, res);

      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sess-1",
          roomName: "safecircle-session-sess-1",
        })
      );
    });
  });
});
