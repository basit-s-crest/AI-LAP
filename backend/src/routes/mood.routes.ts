import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  submitMoodHandler,
  getMoodTrendHandler,
  getAllTrendsHandler,
  getTodayMoodHandler,
} from "../controllers/mood.controller";

const router = Router();

// All mood endpoints require authentication
router.use(authMiddleware);

// POST /api/mood - Submit daily mood
router.post("/", submitMoodHandler);

// GET /api/mood/today - Get today's mood
router.get("/today", getTodayMoodHandler);

// GET /api/mood/trends - Get trend for specified days (default: 7)
router.get("/trends", getMoodTrendHandler);

// GET /api/mood/all-trends - Get all trends (7, 30, 60 days)
router.get("/all-trends", getAllTrendsHandler);

export default router;
