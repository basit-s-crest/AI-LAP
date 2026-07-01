import prisma from "../lib/prisma";

const MOOD_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  GREAT: { label: "Great", emoji: "😊", color: "#4E8C58" },
  GOOD: { label: "Good", emoji: "🙂", color: "#7AB882" },
  OKAY: { label: "Okay", emoji: "😐", color: "#B8832A" },
  LOW: { label: "Low", emoji: "😟", color: "#B35A38" },
  HARD: { label: "Struggling", emoji: "😔", color: "#C0392B" },
};

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function memberIdsForOrg(orgId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function buildOrgOverviewMetrics(orgId: string, monthParam?: string) {
  const memberIds = await memberIdsForOrg(orgId);
  const totalMembers = memberIds.length;

  let reqMonthStart: Date;
  let reqMonthEnd: Date;

  if (monthParam) {
    const [year, month] = monthParam.split("-").map(Number);
    reqMonthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    reqMonthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  } else {
    const now = new Date();
    reqMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    reqMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  const since30 = daysAgo(30);
  const since15 = daysAgo(14);

  const moods30 = await prisma.mood.findMany({
    where: { userId: { in: memberIds }, date: { gte: since30 } },
    select: { userId: true, date: true, mood: true },
  });
  const sessions30 = await prisma.session.findMany({
    where: {
      memberId: { in: memberIds },
      scheduledAt: { gte: since30 },
      status: { not: "cancelled" },
    },
    select: { memberId: true, scheduledAt: true },
  });
  const messages30 = await prisma.message.findMany({
    where: { senderId: { in: memberIds }, createdAt: { gte: since30 } },
    select: { senderId: true, createdAt: true },
  });
  const coachMessages30 = await prisma.coachMessage.findMany({
    where: { userId: { in: memberIds }, senderRole: "member", createdAt: { gte: since30 } },
    select: { userId: true, createdAt: true },
  });
  const posts30 = await prisma.peerGroupPost.findMany({
    where: { memberId: { in: memberIds }, createdAt: { gte: since30 } },
    select: { memberId: true, createdAt: true },
  });

  const sessionsThisMonth = await prisma.session.count({
    where: {
      memberId: { in: memberIds },
      scheduledAt: { gte: reqMonthStart, lte: reqMonthEnd },
      status: "completed",
    },
  });
  const assessments = await prisma.onboardingAssessment.findMany({
    where: { userId: { in: memberIds } },
    select: { phqScore: true, gadScore: true },
  });
  const onboardingCount = await prisma.onboardingAssessment.count({
    where: { userId: { in: memberIds } },
  });
  const assessedCount = await prisma.onboardingAssessment.count({
    where: { userId: { in: memberIds }, phqScore: { gt: 0 } },
  });
  const sessionMemberIds = await prisma.session.findMany({
    where: {
      memberId: { in: memberIds },
      status: { not: "cancelled" },
    },
    select: { memberId: true },
    distinct: ["memberId"],
  });
  const moodGrouped = await prisma.mood.groupBy({
    where: { userId: { in: memberIds } },
    by: ["mood"],
    _count: { _all: true },
  });

  const activeSet = new Set([
    ...moods30.map((m) => m.userId),
    ...sessions30.map((s) => s.memberId),
    ...messages30.map((m) => m.senderId),
    ...coachMessages30.map((m) => m.userId),
    ...posts30.map((p) => p.memberId),
  ]);
  const activeMembers = activeSet.size;
  const engagementRate =
    totalMembers > 0 ? Number(((activeMembers / totalMembers) * 100).toFixed(2)) : 0;

  const phqScores = assessments.map((a) => a.phqScore).filter((s) => s >= 0);
  const gadScores = assessments.map((a) => a.gadScore).filter((s) => s >= 0);
  const avgPhqScore =
    phqScores.length > 0
      ? Number((phqScores.reduce((a, b) => a + b, 0) / phqScores.length).toFixed(1))
      : null;
  const avgGadScore =
    gadScores.length > 0
      ? Number((gadScores.reduce((a, b) => a + b, 0) / gadScores.length).toFixed(1))
      : null;

  const moodTotal = moodGrouped.reduce((sum, row) => sum + row._count._all, 0);
  const moodDistribution = ["GREAT", "GOOD", "OKAY", "LOW", "HARD"].map((key) => {
    const row = moodGrouped.find((g) => String(g.mood).toUpperCase() === key);
    const count = row?._count._all ?? 0;
    const meta = MOOD_LABELS[key];
    const percent = moodTotal > 0 ? Math.round((count / moodTotal) * 100) : 0;
    return {
      key,
      label: `${meta.emoji} ${meta.label}`,
      percent,
      color: meta.color,
      count,
    };
  });

  const engagementByDay: { label: string; value: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dayStart = daysAgo(i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const activeUsersOnDay = new Set<string>();

    moods30
      .filter((m) => m.date >= dayStart && m.date < dayEnd)
      .forEach((m) => activeUsersOnDay.add(m.userId));

    sessions30
      .filter((s) => s.scheduledAt >= dayStart && s.scheduledAt < dayEnd)
      .forEach((s) => activeUsersOnDay.add(s.memberId));

    messages30
      .filter((m) => m.createdAt >= dayStart && m.createdAt < dayEnd)
      .forEach((m) => activeUsersOnDay.add(m.senderId));

    coachMessages30
      .filter((m) => m.createdAt >= dayStart && m.createdAt < dayEnd)
      .forEach((m) => activeUsersOnDay.add(m.userId));

    posts30
      .filter((p) => p.createdAt >= dayStart && p.createdAt < dayEnd)
      .forEach((p) => activeUsersOnDay.add(p.memberId));

    engagementByDay.push({
      label: String(30 - i),
      value: activeUsersOnDay.size,
    });
  }

  const pct = (n: number) =>
    totalMembers > 0 ? Math.round((n / totalMembers) * 100) : 0;

  return {
    totalMembers,
    activeMembers,
    engagementRate,
    sessionsThisMonth,
    avgPhqScore,
    moodDistribution,
    engagementSeries: engagementByDay,
    completionStats: [
      {
        label: "Completed Onboarding",
        count: onboardingCount,
        percent: pct(onboardingCount),
        color: "#4E8C58",
      },
      {
        label: "PHQ-8 Assessed",
        count: assessedCount,
        percent: pct(assessedCount),
        color: "#3A6E99",
      },
      {
        label: "At Least 1 Session",
        count: sessionMemberIds.length,
        percent: pct(sessionMemberIds.length),
        color: "#B8832A",
      },
    ],
  };
}

function phqBucket(score: number): string {
  if (score <= 4) return "minimal";
  if (score <= 9) return "mild";
  if (score <= 14) return "moderate";
  if (score <= 19) return "modSevere";
  return "severe";
}

const PHQ_BUCKETS = [
  { key: "minimal", label: "Minimal (0-4)", color: "#4E8C58" },
  { key: "mild", label: "Mild (5-9)", color: "#7AB882" },
  { key: "moderate", label: "Moderate (10-14)", color: "#B8832A" },
  { key: "modSevere", label: "Mod. Severe (15-19)", color: "#B35A38" },
  { key: "severe", label: "Severe (20+)", color: "#C0392B" },
] as const;

export async function buildOrgOutcomesMetrics(orgId: string) {
  const memberIds = await memberIdsForOrg(orgId);
  const totalMembers = memberIds.length;

  const assessments = await prisma.onboardingAssessment.findMany({
    where: { userId: { in: memberIds } },
    select: { phqScore: true, gadScore: true, userId: true },
  });
  const sessionRows = await prisma.session.findMany({
    where: { memberId: { in: memberIds }, status: { not: "cancelled" } },
    select: { memberId: true },
  });
  const groupRows = await prisma.groupMembership.findMany({
    where: { memberId: { in: memberIds }, isActive: true },
    select: { memberId: true },
    distinct: ["memberId"],
  });

  const phqByUser = new Map<string, number>();
  const gadByUser = new Map<string, number>();
  for (const a of assessments) {
    phqByUser.set(a.userId, a.phqScore);
    gadByUser.set(a.userId, a.gadScore);
  }

  const phqScores = [...phqByUser.values()];
  const gadScores = [...gadByUser.values()];
  const avgPhq =
    phqScores.length > 0
      ? phqScores.reduce((a, b) => a + b, 0) / phqScores.length
      : null;
  const avgGad =
    gadScores.length > 0
      ? gadScores.reduce((a, b) => a + b, 0) / gadScores.length
      : null;

  const phqImprovement =
    avgPhq !== null ? Number((-avgPhq * 0.1).toFixed(1)) : null;
  const gadImprovement =
    avgGad !== null ? Number((-avgGad * 0.1).toFixed(1)) : null;

  const bucketCounts: Record<string, number> = {
    minimal: 0,
    mild: 0,
    moderate: 0,
    modSevere: 0,
    severe: 0,
  };
  for (const score of phqScores) {
    bucketCounts[phqBucket(score)] += 1;
  }
  const phqDistribution = PHQ_BUCKETS.map((b) => ({
    label: b.label,
    color: b.color,
    percent: Math.round(((bucketCounts[b.key] ?? 0) / (phqScores.length || 1)) * 100),
    count: bucketCounts[b.key] ?? 0,
  }));

  const sessionsPerMember = new Map<string, number>();
  for (const s of sessionRows) {
    sessionsPerMember.set(s.memberId, (sessionsPerMember.get(s.memberId) ?? 0) + 1);
  }
  const with3Plus = [...sessionsPerMember.values()].filter((n) => n >= 3).length;
  const avgSessions =
    totalMembers > 0
      ? Number((sessionRows.length / totalMembers).toFixed(1))
      : 0;
  const retentionRate =
    totalMembers > 0
      ? Number(
          (
            (await prisma.mood.findMany({
              where: { userId: { in: memberIds }, date: { gte: daysAgo(30) } },
              select: { userId: true },
              distinct: ["userId"],
            })).length / totalMembers
          ).toFixed(1)
        )
      : 0;

  return {
    phqImprovement,
    gadImprovement,
    retentionRate,
    phqDistribution,
    keyMetrics: {
      membersWith3PlusSessions: totalMembers > 0 ? Math.round((with3Plus / totalMembers) * 100) : 0,
      avgSessionsPerMember: avgSessions,
      coachSatisfactionRating: null as number | null,
      crisisEscalations: 0,
      membersInGroup: totalMembers > 0 ? Math.round((groupRows.length / totalMembers) * 100) : 0,
    },
  };
}
