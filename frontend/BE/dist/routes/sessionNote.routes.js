"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const sessionNote_controller_1 = require("../controllers/sessionNote.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware, (0, auth_middleware_1.requireRole)("coach"));
router.get("/", sessionNote_controller_1.getCoachSessionNotes);
router.get("/session/:sessionId", sessionNote_controller_1.getSessionNote);
router.post("/session/:sessionId", sessionNote_controller_1.saveSessionNote);
router.get("/session/:sessionId/versions", sessionNote_controller_1.getSessionNoteVersions);
// Restored generic routes for manual notes
router.post("/", sessionNote_controller_1.createManualSessionNote);
router.patch("/:id", sessionNote_controller_1.updateManualSessionNote);
router.delete("/:id", sessionNote_controller_1.deleteManualSessionNote);
exports.default = router;
