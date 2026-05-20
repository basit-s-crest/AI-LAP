import { Router } from "express";

import {
  forgotPassword,
  getCoaches,
  getMemberProfile,
  login,
  register,
  resendOtp,
  updateMemberNotifications,
  updateMemberProfile,
  verifyOtp,
} from "../controllers/auth.controller";
import { getPublicPlatformSettings } from "../controllers/platformSettings.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Member auth
router.post("/register", register);          // signup → sends OTP
router.post("/verify-otp", verifyOtp);       // submit OTP → get JWT
router.post("/resend-otp", resendOtp);       // request a fresh OTP
router.post("/login", login);                // login → get JWT
router.post("/forgot-password", forgotPassword);
router.get("/platform-settings", getPublicPlatformSettings);

// Coaches list (auth-protected)
router.get("/coaches", authMiddleware, getCoaches);

// Member profile & settings
router.get("/profile", authMiddleware, getMemberProfile);
router.patch("/profile", authMiddleware, updateMemberProfile);
router.patch("/notifications", authMiddleware, updateMemberNotifications);

export default router;
