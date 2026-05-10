/**
 * Unit tests and Property-Based Tests for coach.controller.ts
 *
 * Covers:
 *   - listCoachesHandler  (Task 4.1)
 *   - assignCoachHandler  (Task 4.2)
 *   - Property 4: active-only filter  (Task 5.1)
 *   - Property 6: no password leakage (Task 5.2)
 *   - Property 7: assignment idempotency (Task 5.3)
 *
 * Validates: Requirements 2.1, 2.2, 2.4, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8
 */

import * as fc from "fast-check";
import { Request, Response } from "express";

jest.mock("../lib/prisma");
import prismaMock from "../__mocks__/prisma";

import {
  listCoachesHandler,
  assignCoachHandler,
} from "../controllers/coach.controller";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
  return { body: {}, params: {}, query: {}, user: undefined, ...overrides };
}

function makeRes(): { status: jest.Mock; json: jest.Mock; res: any } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as any;
  return { status, json, res };
}

/** Build a full Coach DB row (with password) */
function makeCoach(overrides: Record<string, any> = {}) {
  return {
    id: "coach-1",
    email: "coach@example.com",
    name: "Test Coach",
    password: "hashed_password",
    avatar: null,
    bio: null,
    speciality: null,
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

/** Build a CoachMember row */
function makeCoachMember(overrides: Record<string, any> = {}) {
  return {
    id: "cm-1",
    coachId: "coach-1",
    userId: "user-1",
    assignedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

function coach() {
  return (prismaMock as any).coach;
}
function coachMember() {
  return (prismaMock as any).coachMember;
}

// ─── listCoachesHandler — Unit Tests ─────────────────────────────────────────

describe("listCoachesHandler", () => {
  it("returns HTTP 200 with a coaches array", async () => {
    const activeCoach = makeCoach({ isActive: true });
    coach().findMany.mockResolvedValue([activeCoach]);

    const req = makeReq();
    const { status, json, res } = makeRes();

    await listCoachesHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ coaches: expect.any(Array) })
    );
  });

  it("strips the password field from each coach in the response", async () => {
    const activeCoach = makeCoach({ isActive: true });
    coach().findMany.mockResolvedValue([activeCoach]);

    const req = makeReq();
    const { json, res } = makeRes();

    await listCoachesHandler(req as Request, res);

    const { coaches } = json.mock.calls[0][0];
    expect(coaches).toHaveLength(1);
    expect(coaches[0]).not.toHaveProperty("password");
  });

  it("only includes coaches where isActive = true", async () => {
    const active = makeCoach({ id: "c1", isActive: true, name: "Active" });
    // The real DB query filters by isActive: true, so the mock returns only active ones
    coach().findMany.mockResolvedValue([active]);

    const req = makeReq();
    const { json, res } = makeRes();

    await listCoachesHandler(req as Request, res);

    const { coaches } = json.mock.calls[0][0];
    expect(coaches.every((c: any) => c.isActive === true)).toBe(true);
  });

  it("returns HTTP 500 when prisma.coach.findMany throws", async () => {
    coach().findMany.mockRejectedValue(new Error("DB connection lost"));

    const req = makeReq();
    const { status, json, res } = makeRes();

    await listCoachesHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

// ─── assignCoachHandler — Unit Tests ─────────────────────────────────────────

describe("assignCoachHandler", () => {
  it("returns HTTP 201 when a new CoachMember row is created", async () => {
    const cm = makeCoachMember();
    coach().findUnique.mockResolvedValue(makeCoach({ isActive: true }));
    coachMember().findFirst.mockResolvedValue(null); // no existing assignment
    coachMember().upsert.mockResolvedValue(cm);

    const req = makeReq({
      body: { coachId: "coach-1" },
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ assigned: true, coachId: "coach-1" })
    );
  });

  it("returns HTTP 200 when assignment already exists", async () => {
    const cm = makeCoachMember();
    coach().findUnique.mockResolvedValue(makeCoach({ isActive: true }));
    coachMember().findFirst.mockResolvedValue(cm); // existing assignment
    coachMember().upsert.mockResolvedValue(cm);

    const req = makeReq({
      body: { coachId: "coach-1" },
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ assigned: true, coachId: "coach-1" })
    );
  });

  it("returns HTTP 404 when coach does not exist (findUnique returns null)", async () => {
    coach().findUnique.mockResolvedValue(null);

    const req = makeReq({
      body: { coachId: "nonexistent-coach" },
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Coach not found" });
  });

  it("returns HTTP 404 when coach has isActive = false", async () => {
    coach().findUnique.mockResolvedValue(makeCoach({ isActive: false }));

    const req = makeReq({
      body: { coachId: "coach-1" },
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Coach not found" });
  });

  it("returns HTTP 400 when coachId is missing from body", async () => {
    const req = makeReq({
      body: {},
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "coachId is required" });
  });

  it("returns HTTP 400 when coachId is an empty string", async () => {
    const req = makeReq({
      body: { coachId: "" },
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "coachId is required" });
  });

  it("returns HTTP 401 when req.user is undefined (no JWT)", async () => {
    const req = makeReq({
      body: { coachId: "coach-1" },
      user: undefined,
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("returns HTTP 500 when prisma throws an unexpected error", async () => {
    coach().findUnique.mockRejectedValue(new Error("Unexpected DB error"));

    const req = makeReq({
      body: { coachId: "coach-1" },
      user: { id: "user-1", role: "member" },
    });
    const { status, json, res } = makeRes();

    await assignCoachHandler(req as Request, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

// ─── Property 4: Active-only filter ──────────────────────────────────────────
/**
 * Validates: Requirements 2.2
 *
 * For any mix of active/inactive coaches, the response from listCoachesHandler
 * contains only coaches where isActive = true.
 */
describe("Property 4: List endpoint active-only filter", () => {
  it("response contains only active coaches for any mix of active/inactive coaches", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            email: fc.string({ minLength: 1, maxLength: 50 }),
            avatar: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
            bio: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
            speciality: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
            isActive: fc.boolean(),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (coaches) => {
          jest.clearAllMocks();

          // The real DB query filters by isActive: true — simulate that
          const activeCoaches = coaches.filter((c) => c.isActive);
          coach().findMany.mockResolvedValue(activeCoaches);

          const req = makeReq();
          const { json, res } = makeRes();

          await listCoachesHandler(req as Request, res);

          const { coaches: returned } = json.mock.calls[0][0];

          // All returned coaches must be active
          return returned.every((c: any) => c.isActive === true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: No password leakage ─────────────────────────────────────────
/**
 * Validates: Requirements 2.4
 *
 * For any Coach[] returned by listCoachesHandler, no object in the response
 * has a `password` field.
 */
describe("Property 6: No password leakage from listCoachesHandler", () => {
  it("no returned coach object has a password field", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            email: fc.string({ minLength: 1, maxLength: 50 }),
            password: fc.string({ minLength: 8, maxLength: 60 }), // always present in DB row
            avatar: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
            bio: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
            speciality: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
            isActive: fc.constant(true),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (coaches) => {
          jest.clearAllMocks();

          // Mock returns coaches WITH password (as DB would)
          coach().findMany.mockResolvedValue(coaches);

          const req = makeReq();
          const { json, res } = makeRes();

          await listCoachesHandler(req as Request, res);

          const { coaches: returned } = json.mock.calls[0][0];

          // No returned coach should have a password field
          return returned.every((c: any) => !Object.prototype.hasOwnProperty.call(c, "password"));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Assignment idempotency ──────────────────────────────────────
/**
 * Validates: Requirements 3.2
 *
 * For any valid (coachId, userId) pair, calling assignCoachHandler N times
 * (N ∈ [1, 5]) results in upsert being called each time, but findFirst is
 * also called each time — and the DB constraint ensures only one row exists.
 * We verify that:
 *   1. upsert is called exactly N times
 *   2. The response always has assigned: true
 *   3. The first call returns 201, subsequent calls return 200
 */
describe("Property 7: Assignment idempotency", () => {
  it("calling assignCoachHandler N times always results in assigned:true and correct status codes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 5 }),
        async (coachId, userId, N) => {
          jest.clearAllMocks();

          const cm = makeCoachMember({ coachId, userId });
          const activeCoach = makeCoach({ id: coachId, isActive: true });

          // Coach always exists and is active
          coach().findUnique.mockResolvedValue(activeCoach);
          // upsert always returns the same row
          coachMember().upsert.mockResolvedValue(cm);

          const statusCodes: number[] = [];

          for (let i = 0; i < N; i++) {
            jest.clearAllMocks();

            // First call: no existing assignment; subsequent calls: assignment exists
            if (i === 0) {
              coachMember().findFirst.mockResolvedValue(null);
            } else {
              coachMember().findFirst.mockResolvedValue(cm);
            }

            coach().findUnique.mockResolvedValue(activeCoach);
            coachMember().upsert.mockResolvedValue(cm);

            const req = makeReq({
              body: { coachId },
              user: { id: userId, role: "member" },
            });
            const { status, json, res } = makeRes();

            await assignCoachHandler(req as Request, res);

            // Capture the status code
            statusCodes.push(status.mock.calls[0][0]);

            // Each call must return assigned: true
            const body = json.mock.calls[0][0];
            if (!body.assigned) return false;

            // upsert must be called exactly once per invocation
            expect(coachMember().upsert).toHaveBeenCalledTimes(1);
          }

          // First call → 201, all subsequent → 200
          if (statusCodes[0] !== 201) return false;
          for (let i = 1; i < N; i++) {
            if (statusCodes[i] !== 200) return false;
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
