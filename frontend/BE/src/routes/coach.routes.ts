import { Router } from "express";

import {
  assignCoachHandler,
  getCoachPublicByIdHandler,
  getMyMembers,
  getOnDemandStatus,
  listCoachesHandler,
  loginCoach,
  registerCoach,
  setOnDemandStatus,
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

// On-demand status — coach only (must be before /:coachId)
router.get("/on-demand", authMiddleware, requireRole("coach"), getOnDemandStatus);
router.patch("/on-demand", authMiddleware, requireRole("coach"), setOnDemandStatus);

// Authenticated — public coach card for members / org / self-coach
router.get("/:coachId", authMiddleware, getCoachPublicByIdHandler);

// Protected — member assigns themselves to a coach
router.post("/assign", authMiddleware, assignCoachHandler);

export default router;
