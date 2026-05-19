import { Request, Response } from "express";
import prisma from "../lib/prisma";

const SESSION_TYPES = [
  "Weekly Check-in",
  "Initial Session",
  "Follow-up",
  "Crisis",
] as const;

const STATUSES = ["draft", "saved"] as const;

type SessionNoteStatus = (typeof STATUSES)[number];

function isSessionType(value: string): boolean {
  return SESSION_TYPES.includes(value as (typeof SESSION_TYPES)[number]);
}

function isStatus(value: string): value is SessionNoteStatus {
  return STATUSES.includes(value as SessionNoteStatus);
}

async function coachOwnsMember(coachId: string, memberId: string): Promise<boolean> {
  const assignment = await prisma.coachMember.findUnique({
    where: { coachId_userId: { coachId, userId: memberId } },
  });
  return !!assignment;
}

function toDto(note: {
  id: string;
  coachId: string;
  memberId: string;
  sessionType: string;
  notes: string;
  nextSessionGoal: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  member: { id: string; name: string };
}) {
  return {
    id: note.id,
    coachId: note.coachId,
    memberId: note.memberId,
    clientName: note.member.name,
    sessionType: note.sessionType,
    notes: note.notes,
    nextSessionGoal: note.nextSessionGoal,
    status: note.status,
    sessionDate: note.createdAt.toISOString(),
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export const createSessionNote = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const { memberId, sessionType, notes, nextSessionGoal, status } = req.body as {
      memberId?: string;
      sessionType?: string;
      notes?: string;
      nextSessionGoal?: string;
      status?: string;
    };

    if (!memberId || !sessionType) {
      return res.status(400).json({ message: "memberId and sessionType are required" });
    }
    if (!isSessionType(sessionType)) {
      return res.status(400).json({ message: "Invalid sessionType" });
    }
    const noteStatus = status ?? "draft";
    if (!isStatus(noteStatus)) {
      return res.status(400).json({ message: "status must be draft or saved" });
    }

    const owns = await coachOwnsMember(coachId, memberId);
    if (!owns) {
      return res.status(403).json({ message: "Member is not assigned to this coach" });
    }

    const created = await prisma.sessionNote.create({
      data: {
        coachId,
        memberId,
        sessionType,
        notes: notes ?? "",
        nextSessionGoal: nextSessionGoal ?? "",
        status: noteStatus,
      },
      include: { member: { select: { id: true, name: true } } },
    });

    return res.status(201).json({ note: toDto(created) });
  } catch (error) {
    console.error("[createSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getCoachSessionNotes = async (
  req: Request<{ coachId: string }>,
  res: Response
): Promise<Response> => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { coachId } = req.params;
    if (user.role !== "coach" || user.id !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const notes = await prisma.sessionNote.findMany({
      where: { coachId },
      include: { member: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ notes: notes.map(toDto) });
  } catch (error) {
    console.error("[getCoachSessionNotes]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateSessionNote = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const existing = await prisma.sessionNote.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Note not found" });
    if (existing.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { memberId, sessionType, notes, nextSessionGoal, status } = req.body as {
      memberId?: string;
      sessionType?: string;
      notes?: string;
      nextSessionGoal?: string;
      status?: string;
    };

    if (sessionType !== undefined && !isSessionType(sessionType)) {
      return res.status(400).json({ message: "Invalid sessionType" });
    }
    if (status !== undefined && !isStatus(status)) {
      return res.status(400).json({ message: "status must be draft or saved" });
    }
    if (memberId !== undefined && memberId !== existing.memberId) {
      const owns = await coachOwnsMember(coachId, memberId);
      if (!owns) {
        return res.status(403).json({ message: "Member is not assigned to this coach" });
      }
    }

    const updated = await prisma.sessionNote.update({
      where: { id: req.params.id },
      data: {
        ...(memberId !== undefined && { memberId }),
        ...(sessionType !== undefined && { sessionType }),
        ...(notes !== undefined && { notes }),
        ...(nextSessionGoal !== undefined && { nextSessionGoal }),
        ...(status !== undefined && { status }),
      },
      include: { member: { select: { id: true, name: true } } },
    });

    return res.status(200).json({ note: toDto(updated) });
  } catch (error) {
    console.error("[updateSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSessionNote = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const existing = await prisma.sessionNote.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: "Note not found" });
    if (existing.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.sessionNote.delete({ where: { id: req.params.id } });
    return res.status(200).json({ message: "Note deleted" });
  } catch (error) {
    console.error("[deleteSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
