import { Router } from "express";

import {
  assignCoachHandler,
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

// Public — list active coaches (no auth required)
router.get("/list", listCoachesHandler);

// Protected — member assigns themselves to a coach
router.post("/assign", authMiddleware, assignCoachHandler);

// Protected — coach only
router.get("/members", authMiddleware, requireRole("coach"), getMyMembers);

export default router;
