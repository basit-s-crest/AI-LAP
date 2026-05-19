import { Router } from "express";

import {
  assignCoachHandler,
  getCoachProfile,
  getCoachPublicByIdHandler,
  getMyMembers,
  getOnDemandStatus,
  listCoachesHandler,
  loginCoach,
  registerCoach,
  setOnDemandStatus,
  updateCoachNotifications,
  updateCoachProfile,
} from "../controllers/coach.controller";
import { adminGetScoresHistory } from "../controllers/admin.controller";
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

// Coach profile & settings (must be before /:coachId)
router.get("/profile", authMiddleware, requireRole("coach"), getCoachProfile);
router.patch("/profile", authMiddleware, requireRole("coach"), updateCoachProfile);
router.patch("/notifications", authMiddleware, requireRole("coach"), updateCoachNotifications);

// Authenticated — public coach card for members / org / self-coach
router.get("/:coachId", authMiddleware, getCoachPublicByIdHandler);

// Protected — member assigns themselves to a coach
router.post("/assign", authMiddleware, assignCoachHandler);

// Protected — coach / admin only
router.get("/members", authMiddleware, requireRole("coach"), getMyMembers);
router.get("/scores/history", authMiddleware, requireRole("coach", "superadmin"), adminGetScoresHistory);

export default router;
