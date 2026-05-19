import prisma from "../lib/prisma";

export interface MemberStats {
  dayStreak: number;
  checkIns: number;
  groups: number;
  sessions: number;
}

export interface AssessmentScore {
  score: number;
  max: number;
  label: string;
}

function assessmentLabel(instrument: string, score: number): string {
  if (instrument === "PHQ8") {
    if (score >= 15) return "Severe";
    if (score >= 10) return "Moderate";
    if (score >= 5) return "Mild";
    return "Minimal";
  }
  if (instrument === "GAD7") {
    if (score >= 15) return "Severe";
    if (score >= 10) return "Moderate";
    if (score >= 5) return "Mild";
    return "Minimal";
  }
  return "—";
}

function computeDayStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const dayKeys = new Set(
    dates.map((d) => {
      const x = new Date(d);
      x.setUTCHours(0, 0, 0, 0);
      return x.getTime();
    })
  );

  const sorted = [...dayKeys].sort((a, b) => b - a);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let cursor = today.getTime();
  let streak = 0;

  for (const day of sorted) {
    if (day === cursor) {
      streak += 1;
      cursor -= 24 * 60 * 60 * 1000;
    } else if (day === cursor - 24 * 60 * 60 * 1000) {
      streak += 1;
      cursor = day - 24 * 60 * 60 * 1000;
    } else if (streak === 0 && day === cursor - 24 * 60 * 60 * 1000) {
      cursor = day;
      streak = 1;
      cursor -= 24 * 60 * 60 * 1000;
    } else {
      break;
    }
  }

  return streak;
}

export async function getMemberStats(userId: string): Promise<MemberStats> {
  const [moods, groups, sessions] = await Promise.all([
    prisma.mood.findMany({
      where: { userId },
      select: { date: true },
      orderBy: { date: "desc" },
    }),
    prisma.groupMembership.count({
      where: { memberId: userId, isActive: true },
    }),
    prisma.session.count({
      where: { memberId: userId, status: { not: "cancelled" } },
    }),
  ]);

  return {
    dayStreak: computeDayStreak(moods.map((m) => m.date)),
    checkIns: moods.length,
    groups,
    sessions,
  };
}

export async function getMemberAssessments(_userId: string): Promise<{
  phq8: AssessmentScore | null;
  gad7: AssessmentScore | null;
}> {
  return { phq8: null, gad7: null };
}
