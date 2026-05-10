import { Router } from "express";

import {
  forgotPassword,
  login,
  register,
  resendOtp,
  verifyOtp,
} from "../controllers/auth.controller";

const router = Router();

// Member auth
router.post("/register", register);          // signup → sends OTP
router.post("/verify-otp", verifyOtp);       // submit OTP → get JWT
router.post("/resend-otp", resendOtp);       // request a fresh OTP
router.post("/login", login);                // login → get JWT
router.post("/forgot-password", forgotPassword);

export default router;
