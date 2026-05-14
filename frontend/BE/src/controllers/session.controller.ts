import { Request, Response } from "express";
import prisma from "../lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlotEntry = {
  day: string;
  start: string;
  end: string;
  enabled: boolean;
};

// ─── GET /api/sessions/availability/:coachId ─────────────────────────────────
// Auth required. Returns the coach's saved availability slots and duration.

export const getCoachAvailability = async (
  req: Request<{ coachId: string }>,
  res: Response
): Promise<Response> => {
  try {
    const { coachId } = req.params;
    const avail = await prisma.coachAvailability.findUnique({
      where: { coachId },
    });
    if (!avail) {
      return res.status(200).json({ slots: [], duration: 50 });
    }
    return res.status(200).json({ slots: avail.slots, duration: avail.duration });
  } catch (error) {
    console.error("[getCoachAvailability]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── PATCH /api/sessions/availability ────────────────────────────────────────
// Coach only. Upserts the logged-in coach's availability.

export const saveCoachAvailability = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user!.id;
    const { slots, duration } = req.body as { slots: SlotEntry[]; duration: number };

    if (!Array.isArray(slots)) {
      return res.status(400).json({ message: "slots must be an array" });
    }

    const avail = await prisma.coachAvailability.upsert({
      where: { coachId },
      create: {
        coachId,
        slots,
        duration: duration ?? 50,
        updatedAt: new Date(),
      },
      update: {
        slots,
        duration: duration ?? 50,
        updatedAt: new Date(),
      },
    });

    return res.status(200).json({ slots: avail.slots, duration: avail.duration });
  } catch (error) {
    console.error("[saveCoachAvailability]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── GET /api/sessions/coach ──────────────────────────────────────────────────
// Coach only. Returns all sessions for the logged-in coach with member names.

export const getCoachSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user!.id;

    const sessions = await prisma.session.findMany({
      where: { coachId },
      orderBy: { date: "desc" },
    });

    // Batch-fetch member names
    const memberIds = [...new Set(sessions.map((s) => s.memberId))];
    const members = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true },
    });
    const memberMap = Object.fromEntries(members.map((m) => [m.id, m.name]));

    return res.status(200).json(
      sessions.map((s) => ({
        id: s.id,
        coachId: s.coachId,
        memberId: s.memberId,
        memberName: memberMap[s.memberId] ?? "Unknown",
        date: s.date,
        duration: s.duration,
        type: s.type,
        status: s.status,
        createdAt: s.createdAt,
      }))
    );
  } catch (error) {
    console.error("[getCoachSessions]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── POST /api/sessions/book ──────────────────────────────────────────────────
// Auth required (member). Books a session with a coach.

export const bookSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const memberId = req.user!.id;
    const { coachId, date } = req.body as { coachId: string; date: string };

    if (!coachId || !date) {
      return res.status(400).json({ message: "coachId and date are required" });
    }

    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Check coach has availability configured
    const avail = await prisma.coachAvailability.findUnique({
      where: { coachId },
    });

    if (avail) {
      const slots = avail.slots as SlotEntry[];
      const dayName = requestedDate.toLocaleDateString("en-US", { weekday: "long" });
      const enabledDays = slots.filter((s) => s.enabled).map((s) => s.day);
      if (enabledDays.length > 0 && !enabledDays.includes(dayName)) {
        return res.status(400).json({
          message: `Coach is not available on ${dayName}`,
        });
      }
    }

    // Check slot not already booked (same coach, same minute)
    const existing = await prisma.session.findFirst({
      where: {
        coachId,
        date: requestedDate,
        status: { not: "cancelled" },
      },
    });
    if (existing) {
      return res.status(409).json({ message: "This time slot is already booked" });
    }

    const session = await prisma.session.create({
      data: {
        coachId,
        memberId,
        date: requestedDate,
        duration: avail?.duration ?? 50,
        type: "Weekly Check-in",
        status: "upcoming",
      },
    });

    return res.status(201).json(session);
  } catch (error) {
    console.error("[bookSession]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── GET /api/sessions/member ─────────────────────────────────────────────────
// Auth required. Returns all sessions for the logged-in member.

export const getMemberSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const memberId = req.user!.id;

    const sessions = await prisma.session.findMany({
      where: { memberId },
      orderBy: { date: "desc" },
    });

    return res.status(200).json(sessions);
  } catch (error) {
    console.error("[getMemberSessions]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
