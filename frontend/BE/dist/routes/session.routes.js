"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const session_controller_1 = require("../controllers/session.controller");
const router = (0, express_1.Router)();
// Public (auth required) — any logged-in user can fetch a coach's availability
router.get("/availability/:coachId", auth_middleware_1.authMiddleware, session_controller_1.getCoachAvailability);
// Coach only — save their own availability
router.patch("/availability", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), session_controller_1.saveCoachAvailability);
// Coach only — view their own sessions
router.get("/coach", auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"), session_controller_1.getCoachSessions);
// Any authenticated user — book a session
router.post("/book", auth_middleware_1.authMiddleware, session_controller_1.bookSession);
// Any authenticated user — view their own sessions as a member
router.get("/member", auth_middleware_1.authMiddleware, session_controller_1.getMemberSessions);
router.patch("/:id/cancel", auth_middleware_1.authMiddleware, session_controller_1.cancelSession);
router.patch("/:id/reschedule", auth_middleware_1.authMiddleware, session_controller_1.rescheduleSession);
exports.default = router;
