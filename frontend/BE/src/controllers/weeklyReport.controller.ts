import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Helper to get Monday of a given week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to get Sunday of a given week
function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// Generate weekly report data
async function generateReportData(organizationId: string, weekStart: Date, weekEnd: Date) {
  // First, get all member IDs for this organization
  const orgMembers = await prisma.user.findMany({
    where: { organizationId, role: "member" },
    select: { id: true },
  });
  const memberIds = orgMembers.map((m) => m.id);

  const [
    totalMembers,
    activeMembers,
    newMembers,
    sessionsCompleted,
    avgSessionRating,
    crisisAlerts,
    moodEntries,
    groupPosts,
    groupMembers,
    coachMessages,
    phqAssessments,
    gadAssessments,
  ] = await Promise.all([
    // Total members
    Promise.resolve(memberIds.length),
    // Active members (had activity in the week)
    prisma.user.count({
      where: {
        id: { in: memberIds },
        lastActiveAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    // New members joined this week
    prisma.user.count({
      where: {
        id: { in: memberIds },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    // Sessions completed (for organization members)
    prisma.session.count({
      where: {
        memberId: { in: memberIds },
        scheduledAt: { gte: weekStart, lte: weekEnd },
        status: "completed",
      },
    }),
    // Average session rating (mock for now)
    Promise.resolve(null as number | null),
    // Crisis alerts (flagged posts as proxy) - filter by organization members
    prisma.peerGroupPost.count({
      where: {
        memberId: { in: memberIds },
        createdAt: { gte: weekStart, lte: weekEnd },
        isFlagged: true,
      },
    }),
    // Mood entries - filter by organization members
    prisma.mood.count({
      where: {
        userId: { in: memberIds },
        date: { gte: weekStart, lte: weekEnd },
      },
    }),
    // Group posts - filter by organization members
    prisma.peerGroupPost.count({
      where: {
        memberId: { in: memberIds },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    // Group memberships - filter by organization members
    prisma.groupMembership.count({
      where: {
        memberId: { in: memberIds },
        isActive: true,
      },
    }),
    // Coach messages - filter by organization members
    prisma.coachMessage.count({
      where: {
        userId: { in: memberIds },
        createdAt: { gte: weekStart, lte: weekEnd },
      },
    }),
    // PHQ assessments - filter by organization members
    prisma.onboardingAssessment.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { lte: weekEnd },
      },
      select: { phqScore: true },
    }),
    // GAD assessments - filter by organization members
    prisma.onboardingAssessment.findMany({
      where: {
        userId: { in: memberIds },
        createdAt: { lte: weekEnd },
      },
      select: { gadScore: true },
    }),
  ]);

  // Calculate averages
  const avgPhq =
    phqAssessments.length > 0
      ? Math.round(
          phqAssessments.reduce((sum, a) => sum + a.phqScore, 0) / phqAssessments.length
        )
      : null;

  const avgGad =
    gadAssessments.length > 0
      ? Math.round(
          gadAssessments.reduce((sum, a) => sum + a.gadScore, 0) / gadAssessments.length
        )
      : null;

  // Mood distribution - filter by organization members
  const moodData = await prisma.mood.groupBy({
    by: ["mood"],
    where: {
      userId: { in: memberIds },
      date: { gte: weekStart, lte: weekEnd },
    },
    _count: { _all: true },
  });

  

  const moodDistribution = {
    GREAT: moodData.find((m) => m.mood === "GREAT")?._count._all || 0,
    GOOD: moodData.find((m) => m.mood === "GOOD")?._count._all || 0,
    OKAY: moodData.find((m) => m.mood === "OKAY")?._count._all || 0,
    LOW: moodData.find((m) => m.mood === "LOW")?._count._all || 0,
    HARD: moodData.find((m) => m.mood === "HARD")?._count._all || 0,
  };

  // Get top active coaches - filter by organization members
  const topCoaches = await prisma.coachMessage.groupBy({
    by: ["coachId"],
    where: {
      userId: { in: memberIds },
      createdAt: { gte: weekStart, lte: weekEnd },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 5,
  });

  const coachDetails = await Promise.all(
    topCoaches.map(async (tc) => {
      const coach = await prisma.coach.findUnique({
        where: { id: tc.coachId },
        select: { id: true, name: true, speciality: true },
      });
      return {
        id: coach?.id || tc.coachId,
        name: coach?.name || "Unknown",
        speciality: coach?.speciality || null,
        messageCount: tc._count.id,
      };
    })
  );

  // Engagement rate
  const engagementRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;

  return {
    weekStartDate: weekStart.toISOString(),
    weekEndDate: weekEnd.toISOString(),
    summary: {
      totalMembers,
      activeMembers,
      newMembers,
      engagementRate,
      sessionsCompleted,
      avgSessionRating,
      crisisAlerts,
    },
    mentalHealth: {
      avgPhqScore: avgPhq,
      avgGadScore: avgGad,
      moodEntries,
      moodDistribution,
    },
    community: {
      groupPosts,
      groupMembers,
      coachMessages,
    },
    coaches: {
      topActiveCoaches: coachDetails,
    },
  };
}

// Get or generate weekly report
export const getWeeklyReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    // For organization role, orgId IS the organization's ID
    const orgId = req.user?.orgId || req.user?.id;
    if (!orgId) {
      return res.status(403).json({ message: "No organization associated" });
    }

    // Get week from query param or use current week
    const weekParam = req.query.week as string | undefined;
    const targetDate = weekParam ? new Date(weekParam) : new Date();
    
    const weekStart = getMonday(targetDate);
    const weekEnd = getSunday(targetDate);

    // Check if report already exists
    let report = await prisma.weeklyReport.findUnique({
      where: {
        organizationId_weekStartDate: {
          organizationId: orgId,
          weekStartDate: weekStart,
        },
      },
    });

    // If not, generate it
    if (!report) {
      const reportData = await generateReportData(orgId, weekStart, weekEnd);
      report = await prisma.weeklyReport.create({
        data: {
          organizationId: orgId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          reportData,
        },
      });
    }

    return res.status(200).json(report);
  } catch (error) {
    console.error("[getWeeklyReport]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get list of available report weeks
export const getAvailableWeeks = async (req: Request, res: Response): Promise<Response> => {
  try {
    // For organization role, orgId IS the organization's ID
    const orgId = req.user?.orgId || req.user?.id;
    if (!orgId) {
      return res.status(403).json({ message: "No organization associated" });
    }

    // 1. Fetch organization's createdAt to know when they joined
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { createdAt: true },
    });

    // 2. Fetch the oldest existing weekly report to ensure we don't miss anything in DB
    const oldestReport = await prisma.weeklyReport.findFirst({
      where: { organizationId: orgId },
      orderBy: { weekStartDate: "asc" },
      select: { weekStartDate: true },
    });

    // 3. Determine the start date:
    // We want to support all weeks since the organization was created,
    // or at least the last 12 weeks to give plenty of testing data,
    // or since the oldest report in the database.
    let startLimit = new Date();
    startLimit.setDate(startLimit.getDate() - 12 * 7); // 12 weeks ago

    const datesToCompare: Date[] = [startLimit];
    if (org?.createdAt) {
      datesToCompare.push(new Date(org.createdAt));
    }
    if (oldestReport?.weekStartDate) {
      datesToCompare.push(new Date(oldestReport.weekStartDate));
    }

    // Use the earliest date among them
    const earliestDate = new Date(Math.min(...datesToCompare.map((d) => d.getTime())));

    // 4. Generate all week starts (Mondays) from earliestDate's Monday up to the current week's Monday
    const currentMonday = getMonday(new Date());
    const startMonday = getMonday(earliestDate);

    const weeks: Array<{ weekStartDate: string; weekEndDate: string; generatedAt: string }> = [];

    let iterDate = new Date(startMonday);
    while (iterDate <= currentMonday) {
      const wStart = getMonday(iterDate);
      const wEnd = getSunday(iterDate);

      weeks.push({
        weekStartDate: wStart.toISOString(),
        weekEndDate: wEnd.toISOString(),
        generatedAt: wStart.toISOString(),
      });

      // Move to next week (add 7 days)
      iterDate.setDate(iterDate.getDate() + 7);
    }

    // Sort descending so the most recent weeks are at the top of the select dropdown
    weeks.sort((a, b) => new Date(b.weekStartDate).getTime() - new Date(a.weekStartDate).getTime());

    return res.status(200).json(weeks);
  } catch (error) {
    console.error("[getAvailableWeeks]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Regenerate a specific week's report
export const regenerateReport = async (req: Request, res: Response): Promise<Response> => {
  try {
    // For organization role, orgId IS the organization's ID
    const orgId = req.user?.orgId || req.user?.id;
    if (!orgId) {
      return res.status(403).json({ message: "No organization associated" });
    }

    const weekParam = req.query.week as string;
    if (!weekParam) {
      return res.status(400).json({ message: "Week parameter required" });
    }

    const targetDate = new Date(weekParam);
    const weekStart = getMonday(targetDate);
    const weekEnd = getSunday(targetDate);

    const reportData = await generateReportData(orgId, weekStart, weekEnd);

    const report = await prisma.weeklyReport.upsert({
      where: {
        organizationId_weekStartDate: {
          organizationId: orgId,
          weekStartDate: weekStart,
        },
      },
      update: {
        reportData,
        generatedAt: new Date(),
      },
      create: {
        organizationId: orgId,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        reportData,
      },
    });

    return res.status(200).json(report);
  } catch (error) {
    console.error("[regenerateReport]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
