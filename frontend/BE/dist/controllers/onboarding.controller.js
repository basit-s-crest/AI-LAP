"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAssessment = exports.submitAssessment = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
/**
 * POST /api/onboarding
 * Body: { age, identity, gender, orient, phqAnswers, gadAnswers }
 * Calculates PHQ-8 and GAD-7 scores and upserts the user's assessment record.
 */
const submitAssessment = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const userId = req.user.id;
        const { age, identity, gender, orient, phqAnswers, gadAnswers } = req.body;
        // Validate that answers arrays contain numbers if provided
        const validPhqAnswers = Array.isArray(phqAnswers) && phqAnswers.every((v) => typeof v === "number" && v >= 0 && v <= 3)
            ? phqAnswers
            : [];
        const validGadAnswers = Array.isArray(gadAnswers) && gadAnswers.every((v) => typeof v === "number" && v >= 0 && v <= 3)
            ? gadAnswers
            : [];
        // Calculate sum scores
        const phqScore = validPhqAnswers.reduce((acc, v) => acc + v, 0);
        const gadScore = validGadAnswers.reduce((acc, v) => acc + v, 0);
        const assessment = await prisma_1.default.onboardingAssessment.create({
            data: {
                userId,
                age: age || null,
                identity: identity || null,
                gender: gender || null,
                orient: orient || null,
                phqAnswers: validPhqAnswers,
                phqScore,
                gadAnswers: validGadAnswers,
                gadScore,
            },
        });
        return res.status(200).json({
            message: "Onboarding assessment saved successfully",
            assessment,
        });
    }
    catch (error) {
        console.error("[submitAssessment]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.submitAssessment = submitAssessment;
/**
 * GET /api/onboarding/me
 * Retrieves the logged-in user's onboarding assessment.
 */
const getAssessment = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const userId = req.user.id;
        const assessment = await prisma_1.default.onboardingAssessment.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        return res.status(200).json({
            assessment: assessment || null,
        });
    }
    catch (error) {
        console.error("[getAssessment]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getAssessment = getAssessment;
