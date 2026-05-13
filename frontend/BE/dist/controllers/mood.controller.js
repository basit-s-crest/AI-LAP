"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayMoodHandler = exports.getAllTrendsHandler = exports.getMoodTrendHandler = exports.submitMoodHandler = void 0;
const mood_service_1 = require("../services/mood.service");
const submitMoodHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const { mood } = req.body;
        const userId = req.user.id;
        if (!(0, mood_service_1.isMoodValue)(mood)) {
            return res.status(400).json({
                message: "Invalid mood value. Must be one of: GREAT, GOOD, OKAY, LOW, HARD",
            });
        }
        const moodEntry = await (0, mood_service_1.submitMood)(userId, mood);
        return res.status(201).json({
            message: "Mood submitted successfully",
            mood: {
                id: moodEntry.id,
                userId: moodEntry.userId,
                mood: moodEntry.mood,
                date: moodEntry.date.toISOString().split("T")[0],
                score: (0, mood_service_1.getMoodScore)(moodEntry.mood),
                createdAt: moodEntry.createdAt,
                updatedAt: moodEntry.updatedAt,
            },
        });
    }
    catch (error) {
        console.error("[submitMoodHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.submitMoodHandler = submitMoodHandler;
const getMoodTrendHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const userId = req.user.id;
        const daysParam = req.query.days ? parseInt(req.query.days, 10) : 7;
        const validDays = [7, 30, 60];
        const days = validDays.includes(daysParam)
            ? daysParam
            : 7;
        const trend = await (0, mood_service_1.getMoodTrend)(userId, days);
        return res.status(200).json({
            message: "Mood trend retrieved successfully",
            data: trend,
        });
    }
    catch (error) {
        console.error("[getMoodTrendHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMoodTrendHandler = getMoodTrendHandler;
const getAllTrendsHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const userId = req.user.id;
        const trends = await (0, mood_service_1.getMultipleTrends)(userId);
        return res.status(200).json({
            message: "All mood trends retrieved successfully",
            data: trends,
        });
    }
    catch (error) {
        console.error("[getAllTrendsHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getAllTrendsHandler = getAllTrendsHandler;
const getTodayMoodHandler = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        const userId = req.user.id;
        const todayTrend = await (0, mood_service_1.getMoodTrend)(userId, 7);
        const todayMood = todayTrend.records[0] ?? null;
        return res.status(200).json({
            message: "Today's mood retrieved successfully",
            mood: todayMood,
        });
    }
    catch (error) {
        console.error("[getTodayMoodHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getTodayMoodHandler = getTodayMoodHandler;
