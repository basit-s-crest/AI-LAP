import { Router } from "express";

import {
  getConversations,
  getMessages,
  markAsRead,
  sendMessage,
} from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/conversations", getConversations);
router.get("/:userId", getMessages);
router.post("/", sendMessage);
router.put("/:userId/read", markAsRead);

export default router;
