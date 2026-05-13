"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Member auth
router.post("/register", auth_controller_1.register); // signup → sends OTP
router.post("/verify-otp", auth_controller_1.verifyOtp); // submit OTP → get JWT
router.post("/resend-otp", auth_controller_1.resendOtp); // request a fresh OTP
router.post("/login", auth_controller_1.login); // login → get JWT
router.post("/forgot-password", auth_controller_1.forgotPassword);
// Coaches list (auth-protected)
router.get("/coaches", auth_middleware_1.authMiddleware, auth_controller_1.getCoaches);
exports.default = router;
