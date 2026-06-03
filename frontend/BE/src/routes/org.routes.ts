import { Router } from "express";
import {
  getOrgCoaches,
  getOrgMembers,
  getOrgOverview,
  getOrgOutcomes,
  getOrgSettings,
  orgRegister,
  orgLogin,
  updateOrgSettings,
} from "../controllers/org.controller";
import {
  getWeeklyReport,
  getAvailableWeeks,
  regenerateReport,
} from "../controllers/weeklyReport.controller";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", orgLogin);
router.post("/register", orgRegister);
router.get("/overview", authMiddleware, requireRole("organization"), getOrgOverview);
router.get("/outcomes", authMiddleware, requireRole("organization"), getOrgOutcomes);
router.get("/members", authMiddleware, requireRole("organization"), getOrgMembers);
router.get("/coaches", authMiddleware, requireRole("organization"), getOrgCoaches);
router.get("/settings", authMiddleware, requireRole("organization"), getOrgSettings);
router.patch("/settings", authMiddleware, requireRole("organization"), updateOrgSettings);

// Weekly reports
router.get("/weekly-report", authMiddleware, requireRole("organization"), getWeeklyReport);
router.get("/weekly-report/weeks", authMiddleware, requireRole("organization"), getAvailableWeeks);
router.post("/weekly-report/regenerate", authMiddleware, requireRole("organization"), regenerateReport);

export default router;
