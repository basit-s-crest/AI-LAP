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

export default router;
