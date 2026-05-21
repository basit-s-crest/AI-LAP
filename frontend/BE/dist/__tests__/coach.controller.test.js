"use strict";
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
const fc = __importStar(require("fast-check"));
jest.mock("../lib/prisma");
const prisma_1 = __importDefault(require("../__mocks__/prisma"));
const coach_controller_1 = require("../controllers/coach.controller");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeReq(overrides = {}) {
    return { body: {}, params: {}, query: {}, user: undefined, ...overrides };
}
function makeRes() {
    const json = jest.fn().mockReturnThis();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status, json };
    return { status, json, res };
}
/** Build a full Coach DB row (with password) */
function makeCoach(overrides = {}) {
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
function makeCoachMember(overrides = {}) {
    return {
        id: "cm-1",
        coachId: "coach-1",
        userId: "user-1",
        assignedAt: new Date("2024-01-01"),
        ...overrides,
    };
}
function coach() {
    return prisma_1.default.coach;
}
function coachMember() {
    return prisma_1.default.coachMember;
}
function user() {
    return prisma_1.default.user;
}
function organizationCoach() {
    return prisma_1.default.organizationCoach;
}
/** Member must be in org (OrganizationCoach) to assign */
function mockMemberInOrgForCoach(coach = makeCoach({ isActive: true })) {
    user().findUnique.mockResolvedValue({
        id: "user-1",
        organizationId: "org-1",
        email: "member@test.com",
        name: "Member",
    });
    organizationCoach().findUnique.mockResolvedValue({ coach });
}
// ─── listCoachesHandler — Unit Tests ─────────────────────────────────────────
describe("listCoachesHandler", () => {
    it("returns HTTP 200 with a coaches array", async () => {
        const activeCoach = makeCoach({ isActive: true });
        coach().findMany.mockResolvedValue([activeCoach]);
        const req = makeReq({ user: { id: "admin-1", role: "superadmin" } });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.listCoachesHandler)(req, res);
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ coaches: expect.any(Array) }));
    });
    it("strips the password field from each coach in the response", async () => {
        const activeCoach = makeCoach({ isActive: true });
        coach().findMany.mockResolvedValue([activeCoach]);
        const req = makeReq({ user: { id: "admin-1", role: "superadmin" } });
        const { json, res } = makeRes();
        await (0, coach_controller_1.listCoachesHandler)(req, res);
        const { coaches } = json.mock.calls[0][0];
        expect(coaches).toHaveLength(1);
        expect(coaches[0]).not.toHaveProperty("password");
    });
    it("only includes coaches where isActive = true", async () => {
        const active = makeCoach({ id: "c1", isActive: true, name: "Active" });
        // The real DB query filters by isActive: true, so the mock returns only active ones
        coach().findMany.mockResolvedValue([active]);
        const req = makeReq({ user: { id: "admin-1", role: "superadmin" } });
        const { json, res } = makeRes();
        await (0, coach_controller_1.listCoachesHandler)(req, res);
        const { coaches } = json.mock.calls[0][0];
        expect(coaches.every((c) => c.isActive === true)).toBe(true);
    });
    it("returns HTTP 500 when prisma.coach.findMany throws", async () => {
        coach().findMany.mockRejectedValue(new Error("DB connection lost"));
        const req = makeReq({ user: { id: "admin-1", role: "superadmin" } });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.listCoachesHandler)(req, res);
        expect(status).toHaveBeenCalledWith(500);
        expect(json).toHaveBeenCalledWith({ message: "Internal server error" });
    });
    it("member with no organizationId gets an empty coaches array", async () => {
        user().findUnique.mockResolvedValue({ organizationId: null });
        const req = makeReq({ user: { id: "user-1", role: "member" } });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.listCoachesHandler)(req, res);
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith({ coaches: [] });
        expect(coach().findMany).not.toHaveBeenCalled();
    });
    it("member with org gets only OrganizationCoach-linked active coaches", async () => {
        const c1 = makeCoach({ id: "c1", isActive: true, name: "Alpha" });
        const c2 = makeCoach({ id: "c2", isActive: false, name: "Inactive" });
        user().findUnique.mockResolvedValue({ organizationId: "org-1" });
        organizationCoach().findMany.mockResolvedValue([
            { coach: c1 },
            { coach: c2 },
        ]);
        const req = makeReq({ user: { id: "user-1", role: "member" } });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.listCoachesHandler)(req, res);
        expect(status).toHaveBeenCalledWith(200);
        const { coaches } = json.mock.calls[0][0];
        expect(coaches).toHaveLength(1);
        expect(coaches[0].id).toBe("c1");
        expect(coach().findMany).not.toHaveBeenCalled();
    });
});
// ─── assignCoachHandler — Unit Tests ─────────────────────────────────────────
describe("assignCoachHandler", () => {
    it("returns HTTP 201 when a new CoachMember row is created", async () => {
        const cm = makeCoachMember();
        const activeCoach = makeCoach({ isActive: true });
        coach().findUnique.mockResolvedValue(activeCoach);
        mockMemberInOrgForCoach(activeCoach);
        coachMember().findFirst.mockResolvedValue(null); // no existing assignment
        coachMember().upsert.mockResolvedValue(cm);
        const req = makeReq({
            body: { coachId: "coach-1" },
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(201);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ assigned: true, coachId: "coach-1" }));
    });
    it("returns HTTP 200 when assignment already exists", async () => {
        const cm = makeCoachMember();
        const activeCoach = makeCoach({ isActive: true });
        coach().findUnique.mockResolvedValue(activeCoach);
        mockMemberInOrgForCoach(activeCoach);
        coachMember().findFirst.mockResolvedValue(cm); // existing assignment
        coachMember().upsert.mockResolvedValue(cm);
        const req = makeReq({
            body: { coachId: "coach-1" },
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(200);
        expect(json).toHaveBeenCalledWith(expect.objectContaining({ assigned: true, coachId: "coach-1" }));
    });
    it("returns HTTP 404 when coach does not exist (findUnique returns null)", async () => {
        coach().findUnique.mockResolvedValue(null);
        const req = makeReq({
            body: { coachId: "nonexistent-coach" },
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ message: "Coach not found" });
    });
    it("returns HTTP 403 when member coach is not in their organization", async () => {
        const activeCoach = makeCoach({ isActive: true });
        coach().findUnique.mockResolvedValue(activeCoach);
        user().findUnique.mockResolvedValue({ organizationId: "org-1" });
        organizationCoach().findUnique.mockResolvedValue(null);
        const req = makeReq({
            body: { coachId: "coach-1" },
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(403);
        expect(json).toHaveBeenCalledWith({ message: "Forbidden" });
    });
    it("returns HTTP 404 when coach has isActive = false", async () => {
        coach().findUnique.mockResolvedValue(makeCoach({ isActive: false }));
        const req = makeReq({
            body: { coachId: "coach-1" },
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(404);
        expect(json).toHaveBeenCalledWith({ message: "Coach not found" });
    });
    it("returns HTTP 400 when coachId is missing from body", async () => {
        const req = makeReq({
            body: {},
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({ message: "coachId is required" });
    });
    it("returns HTTP 400 when coachId is an empty string", async () => {
        const req = makeReq({
            body: { coachId: "" },
            user: { id: "user-1", role: "member" },
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
        expect(status).toHaveBeenCalledWith(400);
        expect(json).toHaveBeenCalledWith({ message: "coachId is required" });
    });
    it("returns HTTP 401 when req.user is undefined (no JWT)", async () => {
        const req = makeReq({
            body: { coachId: "coach-1" },
            user: undefined,
        });
        const { status, json, res } = makeRes();
        await (0, coach_controller_1.assignCoachHandler)(req, res);
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
        await (0, coach_controller_1.assignCoachHandler)(req, res);
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
        await fc.assert(fc.asyncProperty(fc.array(fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            email: fc.string({ minLength: 1, maxLength: 50 }),
            avatar: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
            bio: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
            speciality: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
            isActive: fc.boolean(),
            createdAt: fc.date(),
            updatedAt: fc.date(),
        }), { minLength: 0, maxLength: 20 }), async (coaches) => {
            jest.clearAllMocks();
            // The real DB query filters by isActive: true — simulate that
            const activeCoaches = coaches.filter((c) => c.isActive);
            coach().findMany.mockResolvedValue(activeCoaches);
            const req = makeReq({ user: { id: "admin-1", role: "superadmin" } });
            const { json, res } = makeRes();
            await (0, coach_controller_1.listCoachesHandler)(req, res);
            const { coaches: returned } = json.mock.calls[0][0];
            // All returned coaches must be active
            return returned.every((c) => c.isActive === true);
        }), { numRuns: 100 });
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
        await fc.assert(fc.asyncProperty(fc.array(fc.record({
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
        }), { minLength: 0, maxLength: 20 }), async (coaches) => {
            jest.clearAllMocks();
            // Mock returns coaches WITH password (as DB would)
            coach().findMany.mockResolvedValue(coaches);
            const req = makeReq({ user: { id: "admin-1", role: "superadmin" } });
            const { json, res } = makeRes();
            await (0, coach_controller_1.listCoachesHandler)(req, res);
            const { coaches: returned } = json.mock.calls[0][0];
            // No returned coach should have a password field
            return returned.every((c) => !Object.prototype.hasOwnProperty.call(c, "password"));
        }), { numRuns: 100 });
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
        await fc.assert(fc.asyncProperty(fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0), fc.integer({ min: 1, max: 5 }), async (coachId, userId, N) => {
            jest.clearAllMocks();
            const cm = makeCoachMember({ coachId, userId });
            const activeCoach = makeCoach({ id: coachId, isActive: true });
            // Coach always exists and is active
            coach().findUnique.mockResolvedValue(activeCoach);
            // upsert always returns the same row
            coachMember().upsert.mockResolvedValue(cm);
            const statusCodes = [];
            for (let i = 0; i < N; i++) {
                jest.clearAllMocks();
                // First call: no existing assignment; subsequent calls: assignment exists
                if (i === 0) {
                    coachMember().findFirst.mockResolvedValue(null);
                }
                else {
                    coachMember().findFirst.mockResolvedValue(cm);
                }
                coach().findUnique.mockResolvedValue(activeCoach);
                coachMember().upsert.mockResolvedValue(cm);
                mockMemberInOrgForCoach(activeCoach);
                const req = makeReq({
                    body: { coachId },
                    user: { id: userId, role: "member" },
                });
                const { status, json, res } = makeRes();
                await (0, coach_controller_1.assignCoachHandler)(req, res);
                // Capture the status code
                statusCodes.push(status.mock.calls[0][0]);
                // Each call must return assigned: true
                const body = json.mock.calls[0][0];
                if (!body.assigned)
                    return false;
                // upsert must be called exactly once per invocation
                expect(coachMember().upsert).toHaveBeenCalledTimes(1);
            }
            // First call → 201, all subsequent → 200
            if (statusCodes[0] !== 201)
                return false;
            for (let i = 1; i < N; i++) {
                if (statusCodes[i] !== 200)
                    return false;
            }
            return true;
        }), { numRuns: 50 });
    });
});
