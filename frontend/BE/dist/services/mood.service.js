"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultipleTrends = exports.getMoodTrend = exports.submitMood = exports.isMoodValue = exports.getMoodScore = exports.VALID_MOODS = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.VALID_MOODS = ["GREAT", "GOOD", "OKAY", "LOW", "HARD"];
const MOOD_SCORES = {
    GREAT: 5,
    GOOD: 4,
    OKAY: 3,
    LOW: 2,
    HARD: 1,
};
const getMoodScore = (mood) => MOOD_SCORES[mood] ?? 3;
exports.getMoodScore = getMoodScore;
const isMoodValue = (value) => {
    return typeof value === "string" && exports.VALID_MOODS.includes(value);
};
exports.isMoodValue = isMoodValue;
const getTodayUTC = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const getDateNDaysAgo = (days) => {
    const today = getTodayUTC();
    return new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
};
/**
 * Create or update today's mood for the current user.
 */
const submitMood = async (userId, mood) => {
    const today = getTodayUTC();
    return prisma_1.default.mood.upsert({
        where: {
            userId_date: {
                userId,
                date: today,
            },
        },
        create: {
            userId,
            mood,
            date: today,
        },
        update: {
            mood,
            updatedAt: new Date(),
        },
    });
};
exports.submitMood = submitMood;
/**
 * Returns only the mood rows that exist in the DB for the given user
 * in the last 7 / 30 / 60 days, including today.
 */
const getMoodTrend = async (userId, days = 7) => {
    const startDate = getDateNDaysAgo(days);
    const endDate = getTodayUTC();
    endDate.setDate(endDate.getDate() + 1); // include today
    const rows = await prisma_1.default.mood.findMany({
        where: {
            userId,
            date: {
                gte: startDate,
                lt: endDate,
            },
        },
        orderBy: { date: "asc" },
    });
    const records = rows.map((row) => {
        const mood = row.mood;
        return {
            date: row.date.toISOString().split("T")[0],
            mood,
            score: (0, exports.getMoodScore)(mood),
        };
    });
    const totalTracked = records.length;
    const averageMood = totalTracked > 0
        ? parseFloat((records.reduce((sum, item) => sum + item.score, 0) / totalTracked).toFixed(2))
        : 0;
    const moodFrequency = {
        GREAT: 0,
        GOOD: 0,
        OKAY: 0,
        LOW: 0,
        HARD: 0,
    };
    records.forEach((r) => {
        moodFrequency[r.mood]++;
    });
    let mostFrequentMood = null;
    let maxCount = 0;
    Object.keys(moodFrequency).forEach((mood) => {
        if (moodFrequency[mood] > maxCount) {
            maxCount = moodFrequency[mood];
            mostFrequentMood = mood;
        }
    });
    return {
        period: days,
        totalTracked,
        records,
        averageMood,
        mostFrequentMood,
        consistency: parseFloat(((totalTracked / days) * 100).toFixed(2)),
    };
};
exports.getMoodTrend = getMoodTrend;
const getMultipleTrends = async (userId) => {
    const [week, month, twoMonths] = await Promise.all([
        (0, exports.getMoodTrend)(userId, 7),
        (0, exports.getMoodTrend)(userId, 30),
        (0, exports.getMoodTrend)(userId, 60),
    ]);
    return { week, month, twoMonths };
};
exports.getMultipleTrends = getMultipleTrends;
