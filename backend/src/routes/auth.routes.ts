import { Router } from "express";

import {
  forgotPassword,
  login,
  register,
  verifyOtp,
} from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/forgot-password", forgotPassword);

export default router;
