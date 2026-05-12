import { Router } from "express";

import {
  forgotPassword,
  getCoaches,
  login,
  register,
  resendOtp,
  verifyOtp,
} from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Member auth
router.post("/register", register);          // signup → sends OTP
router.post("/verify-otp", verifyOtp);       // submit OTP → get JWT
router.post("/resend-otp", resendOtp);       // request a fresh OTP
router.post("/login", login);                // login → get JWT
router.post("/forgot-password", forgotPassword);

// Coaches list (auth-protected)
router.get("/coaches", authMiddleware, getCoaches);

export default router;
