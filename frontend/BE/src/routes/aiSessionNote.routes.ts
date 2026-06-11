import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import {
  createAiSessionNote,
  getAiSessionNoteBySessionId,
} from "../controllers/aiSessionNote.controller";

const router = Router();

// Only authenticated coaches can access AI Session Notes endpoints
router.use(authMiddleware, requireRole("coach"));

router.post("/", createAiSessionNote);
router.get("/session/:sessionId", getAiSessionNoteBySessionId);

export default router;
