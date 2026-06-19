"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const platformSettings_controller_1 = require("../controllers/platformSettings.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Member auth
router.post("/register", auth_controller_1.register); // signup → sends OTP
router.post("/verify-otp", auth_controller_1.verifyOtp); // submit OTP → get JWT
router.post("/resend-otp", auth_controller_1.resendOtp); // request a fresh OTP
router.post("/login", auth_controller_1.login); // login → get JWT
router.post("/forgot-password", auth_controller_1.forgotPassword);
router.get("/platform-settings", platformSettings_controller_1.getPublicPlatformSettings);
// Coaches list (auth-protected)
router.get("/coaches", auth_middleware_1.authMiddleware, auth_controller_1.getCoaches);
// Member profile & settings
router.get("/profile", auth_middleware_1.authMiddleware, auth_controller_1.getMemberProfile);
router.patch("/profile", auth_middleware_1.authMiddleware, auth_controller_1.updateMemberProfile);
router.patch("/notifications", auth_middleware_1.authMiddleware, auth_controller_1.updateMemberNotifications);
router.get("/consent", auth_middleware_1.authMiddleware, auth_controller_1.getMemberConsent);
router.post("/consent", auth_middleware_1.authMiddleware, auth_controller_1.updateMemberConsent);
exports.default = router;
