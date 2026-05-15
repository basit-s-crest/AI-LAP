import { Router } from "express";

import {
  assignCoachHandler,
  getCoachPublicByIdHandler,
  getMyMembers,
  listCoachesHandler,
  loginCoach,
  registerCoach,
} from "../controllers/coach.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

// Public coach auth
router.post("/register", registerCoach);
router.post("/login", loginCoach);

// Authenticated — org-scoped for members (see listCoachesHandler)
router.get("/list", authMiddleware, listCoachesHandler);

// Protected — coach only (must be registered before /:coachId)
router.get("/members", authMiddleware, requireRole("coach"), getMyMembers);

// Authenticated — public coach card for members / org / self-coach
router.get("/:coachId", authMiddleware, getCoachPublicByIdHandler);

// Protected — member assigns themselves to a coach
router.post("/assign", authMiddleware, assignCoachHandler);

export default router;
