import { Router } from "express";

import {
  createGroup,
  createPost,
  getGroupById,
  getGroups,
  getPosts,
  joinGroup,
  leaveGroup,
} from "../controllers/group.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/", getGroups);
router.get("/:id", getGroupById);
router.post("/:id/join", joinGroup);
router.post("/:id/leave", leaveGroup);
router.post("/", createGroup);
router.get("/:id/posts", getPosts);
router.post("/:id/posts", createPost);

export default router;
