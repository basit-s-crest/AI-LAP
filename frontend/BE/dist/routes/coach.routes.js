"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const coach_controller_1 = require("../controllers/coach.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public coach auth
router.post("/register", coach_controller_1.registerCoach);
router.post("/login", coach_controller_1.loginCoach);
// Authenticated — org-scoped for members (see listCoachesHandler)
router.get("/list", auth_middleware_1.authMiddleware, coach_controller_1.listCoachesHandler);
// Protected — coach only (must be registered before /:coachId)
router.get("/members", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.getMyMembers);
// On-demand status — coach only (must be before /:coachId)
router.get("/on-demand", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.getOnDemandStatus);
router.patch("/on-demand", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.setOnDemandStatus);
// Coach profile & settings (must be before /:coachId)
router.get("/profile", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.getCoachProfile);
router.patch("/profile", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.updateCoachProfile);
router.patch("/notifications", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.updateCoachNotifications);
// Authenticated — public coach card for members / org / self-coach
router.get("/:coachId", auth_middleware_1.authMiddleware, coach_controller_1.getCoachPublicByIdHandler);
// Protected — member assigns themselves to a coach
router.post("/assign", auth_middleware_1.authMiddleware, coach_controller_1.assignCoachHandler);
// Protected — coach / admin only
router.get("/members", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), coach_controller_1.getMyMembers);
router.get("/scores/history", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach", "superadmin"), admin_controller_1.adminGetScoresHistory);
exports.default = router;
