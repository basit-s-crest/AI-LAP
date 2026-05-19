import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import {
  createSessionNote,
  getCoachSessionNotes,
  updateSessionNote,
  deleteSessionNote,
} from "../controllers/sessionNote.controller";

const router = Router();

router.use(authMiddleware, requireRole("coach"));

router.post("/", createSessionNote);
router.get("/coach/:coachId", getCoachSessionNotes);
router.patch("/:id", updateSessionNote);
router.delete("/:id", deleteSessionNote);

export default router;
