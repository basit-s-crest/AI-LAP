import { Router } from "express";
import { getAssessment, submitAssessment } from "../controllers/onboarding.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/", authMiddleware, submitAssessment);
router.get("/me", authMiddleware, getAssessment);

export default router;
