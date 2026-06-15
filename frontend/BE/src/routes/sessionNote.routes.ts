import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import {
  getCoachSessionNotes,
  getSessionNote,
  saveSessionNote,
  getSessionNoteVersions,
  createManualSessionNote,
  updateManualSessionNote,
  deleteManualSessionNote,
} from "../controllers/sessionNote.controller";

const router = Router();

router.use(authMiddleware, requireRole("coach"));

router.get("/", getCoachSessionNotes);
router.get("/session/:sessionId", getSessionNote);
router.post("/session/:sessionId", saveSessionNote);
router.get("/session/:sessionId/versions", getSessionNoteVersions);

// Restored generic routes for manual notes
router.post("/", createManualSessionNote);
router.patch("/:id", updateManualSessionNote);
router.delete("/:id", deleteManualSessionNote);

export default router;
