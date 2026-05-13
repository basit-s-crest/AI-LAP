"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const coach_controller_1 = require("../controllers/coach.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public coach auth
router.post("/register", coach_controller_1.registerCoach);
router.post("/login", coach_controller_1.loginCoach);
// Public — list active coaches (no auth required)
router.get("/list", coach_controller_1.listCoachesHandler);
// Protected — member assigns themselves to a coach
router.post("/assign", auth_middleware_1.authMiddleware, coach_controller_1.assignCoachHandler);
// Protected — coach only
router.get("/members", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.getMyMembers);
exports.default = router;
