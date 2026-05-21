"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const coachMessage_controller_1 = require("../controllers/coachMessage.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// GET /api/coach-messages — conversation list
router.get("/", coachMessage_controller_1.getConversationListHandler);
// GET /api/coach-messages/unread-count
router.get("/unread-count", coachMessage_controller_1.getUnreadCountHandler);
// GET /api/coach-messages/:partnerId — thread history with cursor pagination
router.get("/:partnerId", coachMessage_controller_1.getThreadHandler);
// POST /api/coach-messages/:partnerId/read — mark messages as read
router.post("/:partnerId/read", coachMessage_controller_1.markReadHandler);
exports.default = router;
