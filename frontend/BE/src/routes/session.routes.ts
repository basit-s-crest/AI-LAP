import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import {
  getCoachAvailability,
  saveCoachAvailability,
  getCoachSessions,
  bookSession,
  getMemberSessions,
} from "../controllers/session.controller";

const router = Router();

// Public (auth required) — any logged-in user can fetch a coach's availability
router.get("/availability/:coachId", authMiddleware, getCoachAvailability);

// Coach only — save their own availability
router.patch("/availability", authMiddleware, requireRole("coach"), saveCoachAvailability);

// Coach only — view their own sessions
router.get("/coach", authMiddleware, requireRole("coach"), getCoachSessions);

// Any authenticated user — book a session
router.post("/book", authMiddleware, bookSession);

// Any authenticated user — view their own sessions as a member
router.get("/member", authMiddleware, getMemberSessions);

export default router;
