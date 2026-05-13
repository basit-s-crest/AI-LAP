"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const mood_controller_1 = require("../controllers/mood.controller");
const router = (0, express_1.Router)();
// All mood endpoints require authentication
router.use(auth_middleware_1.authMiddleware);
// POST /api/mood - Submit daily mood
router.post("/", mood_controller_1.submitMoodHandler);
// GET /api/mood/today - Get today's mood
router.get("/today", mood_controller_1.getTodayMoodHandler);
// GET /api/mood/trends - Get trend for specified days (default: 7)
router.get("/trends", mood_controller_1.getMoodTrendHandler);
// GET /api/mood/all-trends - Get all trends (7, 30, 60 days)
router.get("/all-trends", mood_controller_1.getAllTrendsHandler);
exports.default = router;
