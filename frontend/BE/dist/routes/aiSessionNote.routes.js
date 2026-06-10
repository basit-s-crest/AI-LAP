"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const aiSessionNote_controller_1 = require("../controllers/aiSessionNote.controller");
const router = (0, express_1.Router)();
// Only authenticated coaches can access AI Session Notes endpoints
router.use(auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"));
router.post("/", aiSessionNote_controller_1.createAiSessionNote);
router.get("/session/:sessionId", aiSessionNote_controller_1.getAiSessionNoteBySessionId);
exports.default = router;
