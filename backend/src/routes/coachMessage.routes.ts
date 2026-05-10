import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getThreadHandler,
  markReadHandler,
  getConversationListHandler,
} from "../controllers/coachMessage.controller";

const router = Router();

router.use(authMiddleware);

// GET /api/coach-messages — conversation list
router.get("/", getConversationListHandler);

// GET /api/coach-messages/:partnerId — thread history with cursor pagination
router.get("/:partnerId", getThreadHandler);

// POST /api/coach-messages/:partnerId/read — mark messages as read
router.post("/:partnerId/read", markReadHandler);

export default router;
