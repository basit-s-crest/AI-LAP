import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import {
  getCoachAvailability,
  saveCoachAvailability,
  getCoachSessions,
  bookSession,
  getMemberSessions,
  cancelSession,
  rescheduleSession,
} from "../controllers/session.controller";
import {
  startVideoSession,
  getVideoToken,
  getVideoStatus,
} from "../controllers/livekit.controller";

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

router.patch("/:id/cancel", authMiddleware, cancelSession);
router.patch("/:id/reschedule", authMiddleware, rescheduleSession);

// LiveKit Video Endpoints
router.post("/:id/livekit/start", authMiddleware, requireRole("coach"), startVideoSession);
router.post("/:id/livekit/token", authMiddleware, requireRole("coach", "member"), getVideoToken);
router.get("/:id/livekit/status", authMiddleware, requireRole("coach", "member"), getVideoStatus);

export default router;
