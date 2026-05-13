import prisma from "../lib/prisma";

export const VALID_MOODS = ["GREAT", "GOOD", "OKAY", "LOW", "HARD"] as const;
export type MoodValue = (typeof VALID_MOODS)[number];

export interface MoodTrendRecord {
  date: string; // YYYY-MM-DD
  mood: MoodValue;
  score: number;
}

export interface MoodTrendResponse {
  period: number;
  totalTracked: number;
  records: MoodTrendRecord[];
  averageMood: number;
  mostFrequentMood: MoodValue | null;
  consistency: number;
}

export interface MultipleMoodTrendsResponse {
  week: MoodTrendResponse;
  month: MoodTrendResponse;
  twoMonths: MoodTrendResponse;
}

const MOOD_SCORES: Record<MoodValue, number> = {
  GREAT: 5,
  GOOD: 4,
  OKAY: 3,
  LOW: 2,
  HARD: 1,
};

export const getMoodScore = (mood: MoodValue): number => MOOD_SCORES[mood] ?? 3;

export const isMoodValue = (value: unknown): value is MoodValue => {
  return typeof value === "string" && (VALID_MOODS as readonly string[]).includes(value);
};

const getTodayUTC = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const getDateNDaysAgo = (days: number): Date => {
  const today = getTodayUTC();
  return new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
};

/**
 * Create or update today's mood for the current user.
 */
export const submitMood = async (userId: string, mood: MoodValue) => {
  const today = getTodayUTC();

  return prisma.mood.upsert({
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

/**
 * Returns only the mood rows that exist in the DB for the given user
 * in the last 7 / 30 / 60 days, including today.
 */
export const getMoodTrend = async (
  userId: string,
  days: 7 | 30 | 60 = 7
): Promise<MoodTrendResponse> => {
  const startDate = getDateNDaysAgo(days);
  const endDate = getTodayUTC();
  endDate.setDate(endDate.getDate() + 1); // include today

  const rows = await prisma.mood.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
    orderBy: { date: "asc" },
  });

  const records: MoodTrendRecord[] = rows.map((row) => {
    const mood = row.mood as MoodValue;
    return {
      date: row.date.toISOString().split("T")[0],
      mood,
      score: getMoodScore(mood),
    };
  });

  const totalTracked = records.length;

  const averageMood =
    totalTracked > 0
      ? parseFloat(
          (
            records.reduce((sum, item) => sum + item.score, 0) / totalTracked
          ).toFixed(2)
        )
      : 0;

  const moodFrequency: Record<MoodValue, number> = {
    GREAT: 0,
    GOOD: 0,
    OKAY: 0,
    LOW: 0,
    HARD: 0,
  };

  records.forEach((r) => {
    moodFrequency[r.mood]++;
  });

  let mostFrequentMood: MoodValue | null = null;
  let maxCount = 0;

  (Object.keys(moodFrequency) as MoodValue[]).forEach((mood) => {
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

export const getMultipleTrends = async (userId: string): Promise<MultipleMoodTrendsResponse> => {
  const [week, month, twoMonths] = await Promise.all([
    getMoodTrend(userId, 7),
    getMoodTrend(userId, 30),
    getMoodTrend(userId, 60),
  ]);

  return { week, month, twoMonths };
};