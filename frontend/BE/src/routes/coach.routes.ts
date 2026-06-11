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
  getMemberRiskReport,
  recalculateMemberRisk,
  getOrgRiskSummary,
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

// Risk Engine Proxy APIs
router.get("/risk/member/:memberToken", authMiddleware, requireRole("coach", "superadmin"), getMemberRiskReport);
router.post("/risk/member/:memberToken/recalculate", authMiddleware, requireRole("coach", "superadmin"), recalculateMemberRisk);
router.get("/risk/org/:orgId/summary", authMiddleware, requireRole("coach", "superadmin"), getOrgRiskSummary);

export default router;
