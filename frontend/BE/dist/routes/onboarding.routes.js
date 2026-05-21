"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const onboarding_controller_1 = require("../controllers/onboarding.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.post("/", auth_middleware_1.authMiddleware, onboarding_controller_1.submitAssessment);
router.get("/me", auth_middleware_1.authMiddleware, onboarding_controller_1.getAssessment);
exports.default = router;
