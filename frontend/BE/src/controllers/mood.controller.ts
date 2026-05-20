import { Request, Response } from "express";
import {
  submitMood,
  getMoodTrend,
  getMultipleTrends,
  getMoodScore,
  isMoodValue,
} from "../services/mood.service";

export const submitMoodHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const { mood } = req.body;
    const userId = req.user.id;

    if (!isMoodValue(mood)) {
      return res.status(400).json({
        message: "Invalid mood value. Must be one of: GREAT, GOOD, OKAY, LOW, HARD",
      });
    }

    const moodEntry = await submitMood(userId, mood);

    return res.status(201).json({
      message: "Mood submitted successfully",
      mood: {
        id: moodEntry.id,
        userId: moodEntry.userId,
        mood: moodEntry.mood,
        date: moodEntry.date.toISOString().split("T")[0],
        score: getMoodScore(moodEntry.mood as any),
        createdAt: moodEntry.createdAt,
        updatedAt: moodEntry.updatedAt,
      },
    });
  } catch (error) {
    console.error("[submitMoodHandler]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMoodTrendHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const daysParam = req.query.days ? parseInt(req.query.days as string, 10) : 7;

    const validDays = [7, 30, 60] as const;
    const days = validDays.includes(daysParam as 7 | 30 | 60)
      ? (daysParam as 7 | 30 | 60)
      : 7;

    const trend = await getMoodTrend(userId, days);

    return res.status(200).json({
      message: "Mood trend retrieved successfully",
      data: trend,
    });
  } catch (error) {
    console.error("[getMoodTrendHandler]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllTrendsHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const trends = await getMultipleTrends(userId);

    return res.status(200).json({
      message: "All mood trends retrieved successfully",
      data: trends,
    });
  } catch (error) {
    console.error("[getAllTrendsHandler]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getTodayMoodHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const userId = req.user.id;
    const todayTrend = await getMoodTrend(userId, 7);
    const todayRecord = todayTrend.records.find((r) => {
      const today = new Date();
      const todayKey = today.toISOString().split("T")[0];
      return r.date === todayKey;
    });

    return res.status(200).json({
      logged: Boolean(todayRecord),
      mood: todayRecord?.mood,
    });
  } catch (error) {
    console.error("[getTodayMoodHandler]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};