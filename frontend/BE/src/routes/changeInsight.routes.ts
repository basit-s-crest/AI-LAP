import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { getChangeInsights, compareSessionNotes } from "../controllers/changeInsight.controller";

const router = Router();

// Retrieve historical change insights timeline (accessible to member themselves or their coach)
router.get("/", authMiddleware, getChangeInsights);

// Trigger a comparison run post-save (accessible only to the assigned coach)
router.post("/compare", authMiddleware, requireRole("coach"), compareSessionNotes);

export default router;
