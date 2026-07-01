import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const getCoachSessionNotes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const notes = await prisma.sessionNote.findMany({
      where: { coachId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
        member: { select: { id: true, name: true } },
        session: { select: { type: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const mappedNotes = notes.map((note) => {
      const latest = note.versions[0];
      return {
        id: note.id,
        sessionId: note.sessionId,
        coachId: note.coachId,
        memberId: note.memberId,
        clientName: note.member.name,
        aiSessionNoteId: note.aiSessionNoteId,
        status: note.status,
        sessionType: note.session?.type || note.sessionType || "Weekly Check-in",
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        version: latest ? latest.version : null,
        summary: latest ? latest.summary : "",
        keyThemes: latest ? latest.keyThemes : [],
        memberSentiment: latest ? latest.memberSentiment : "Neutral",
        coachObservations: latest ? latest.coachObservations : "",
        riskFlag: latest ? latest.riskFlag : false,
        riskNotes: latest ? latest.riskNotes : "",
        recommendedFollowUp: latest ? latest.recommendedFollowUp : "",
        emotionTimeline: latest ? latest.emotionTimeline : null,
        emotionCounts: latest ? latest.emotionCounts : null,
      };
    });

    return res.status(200).json({ notes: mappedNotes });
  } catch (error) {
    console.error("[getCoachSessionNotes]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getSessionNote = async (
  req: Request<{ sessionId: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const note = await prisma.sessionNote.findUnique({
      where: { sessionId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
        member: { select: { id: true, name: true } },
        session: { select: { type: true } },
      },
    });

    if (note) {
      const latest = note.versions[0];
      return res.status(200).json({
        exists: true,
        note: {
          id: note.id,
          sessionId: note.sessionId,
          coachId: note.coachId,
          memberId: note.memberId,
          clientName: note.member.name,
          aiSessionNoteId: note.aiSessionNoteId,
          status: note.status,
          sessionType: note.session?.type || note.sessionType || "Weekly Check-in",
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
          version: latest ? latest.version : null,
          summary: latest ? latest.summary : "",
          keyThemes: latest ? latest.keyThemes : [],
          memberSentiment: latest ? latest.memberSentiment : "Neutral",
          coachObservations: latest ? latest.coachObservations : "",
          riskFlag: latest ? latest.riskFlag : false,
          riskNotes: latest ? latest.riskNotes : "",
          recommendedFollowUp: latest ? latest.recommendedFollowUp : "",
          createdById: latest ? latest.createdById : "",
          versionCreatedAt: latest ? latest.createdAt.toISOString() : "",
          emotionTimeline: latest ? latest.emotionTimeline : null,
          emotionCounts: latest ? latest.emotionCounts : null,
        },
      });
    }

    // Prefill from AiSessionNote if exists
    const aiNote = await prisma.aiSessionNote.findFirst({
      where: { sessionId },
    });

    if (aiNote) {
      return res.status(200).json({
        exists: false,
        prefillData: {
          aiSessionNoteId: aiNote.id,
          summary: aiNote.summary,
          keyThemes: aiNote.keyThemes,
          memberSentiment: aiNote.memberSentiment,
          coachObservations: aiNote.coachObservations,
          riskFlag: aiNote.riskFlag,
          riskNotes: aiNote.riskNotes,
          recommendedFollowUp: aiNote.recommendedFollowUp,
          emotionTimeline: aiNote.emotionTimeline,
          emotionCounts: aiNote.emotionCounts,
        },
      });
    }

    return res.status(200).json({
      exists: false,
      prefillData: null,
    });
  } catch (error) {
    console.error("[getSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const saveSessionNote = async (
  req: Request<{ sessionId: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const { sessionId } = req.params;
    const {
      summary,
      keyThemes,
      memberSentiment,
      coachObservations,
      riskFlag,
      riskNotes,
      recommendedFollowUp,
      status,
      aiSessionNoteId,
      sessionType,
      emotionTimeline,
      emotionCounts,
    } = req.body as {
      summary?: string;
      keyThemes?: any;
      memberSentiment?: string;
      coachObservations?: string;
      riskFlag?: boolean;
      riskNotes?: string;
      recommendedFollowUp?: string;
      status?: "DRAFT" | "FINAL";
      aiSessionNoteId?: string;
      sessionType?: string;
      emotionTimeline?: any;
      emotionCounts?: any;
    };

    if (!status || (status !== "DRAFT" && status !== "FINAL")) {
      return res.status(400).json({ message: "Invalid status. Must be DRAFT or FINAL" });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const validatedKeyThemes = Array.isArray(keyThemes) ? keyThemes : [];

    const result = await prisma.$transaction(async (tx) => {
      let note = await tx.sessionNote.findUnique({
        where: { sessionId },
      });

      let newVersionNumber = 1;

      if (sessionType) {
        await tx.session.update({
          where: { id: sessionId },
          data: { type: sessionType },
        });
      }

      if (!note) {
        note = await tx.sessionNote.create({
          data: {
            sessionId,
            coachId,
            memberId: session.memberId,
            aiSessionNoteId: aiSessionNoteId || null,
            status,
            sessionType: sessionType || "Weekly Check-in",
          },
        });
      } else {
        const latestVersion = await tx.sessionNoteVersion.findFirst({
          where: { noteId: note.id },
          orderBy: { version: "desc" },
        });
        if (latestVersion) {
          newVersionNumber = latestVersion.version + 1;
        }

        note = await tx.sessionNote.update({
          where: { id: note.id },
          data: {
            status,
            sessionType: sessionType || undefined,
            updatedAt: new Date(),
          },
        });
      }

      const version = await tx.sessionNoteVersion.create({
        data: {
          noteId: note.id,
          version: newVersionNumber,
          summary: summary || "",
          keyThemes: validatedKeyThemes,
          memberSentiment: memberSentiment || "Neutral",
          coachObservations: coachObservations || "",
          riskFlag: riskFlag ?? false,
          riskNotes: riskNotes || "",
          recommendedFollowUp: recommendedFollowUp || "",
          createdById: coachId,
          emotionTimeline: emotionTimeline || null,
          emotionCounts: emotionCounts || null,
        },
      });

      return { note, version };
    });

    const member = await prisma.user.findUnique({
      where: { id: session.memberId },
      select: { name: true },
    });

    return res.status(200).json({
      message: "Session note saved successfully",
      note: {
        id: result.note.id,
        sessionId: result.note.sessionId,
        coachId: result.note.coachId,
        memberId: result.note.memberId,
        clientName: member?.name || "",
        aiSessionNoteId: result.note.aiSessionNoteId,
        status: result.note.status,
        sessionType: sessionType || result.note.sessionType || "Weekly Check-in",
        createdAt: result.note.createdAt.toISOString(),
        updatedAt: result.note.updatedAt.toISOString(),
        version: result.version.version,
        summary: result.version.summary,
        keyThemes: result.version.keyThemes,
        memberSentiment: result.version.memberSentiment,
        coachObservations: result.version.coachObservations,
        riskFlag: result.version.riskFlag,
        riskNotes: result.version.riskNotes,
        recommendedFollowUp: result.version.recommendedFollowUp,
        createdById: result.version.createdById,
        versionCreatedAt: result.version.createdAt.toISOString(),
        emotionTimeline: result.version.emotionTimeline,
        emotionCounts: result.version.emotionCounts,
      },
    });
  } catch (error) {
    console.error("[saveSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getSessionNoteVersions = async (
  req: Request<{ sessionId: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const note = await prisma.sessionNote.findUnique({
      where: { sessionId },
    });
    if (!note) {
      return res.status(404).json({ message: "Session note not found" });
    }

    const versions = await prisma.sessionNoteVersion.findMany({
      where: { noteId: note.id },
      orderBy: { version: "desc" },
    });

    return res.status(200).json({ versions });
  } catch (error) {
    console.error("[getSessionNoteVersions]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createManualSessionNote = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const { memberId, notes, nextSessionGoal, status, sessionType } = req.body as {
      memberId?: string;
      notes?: string;
      nextSessionGoal?: string;
      status?: "draft" | "saved" | "DRAFT" | "FINAL";
      sessionType?: string;
    };

    if (!memberId) {
      return res.status(400).json({ message: "memberId is required" });
    }

    let noteStatus: "DRAFT" | "FINAL" = "DRAFT";
    if (status === "saved" || status === "FINAL") {
      noteStatus = "FINAL";
    }

    const owns = await prisma.coachMember.findUnique({
      where: { coachId_userId: { coachId, userId: memberId } },
    });
    if (!owns) {
      return res.status(403).json({ message: "Member is not assigned to this coach" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const note = await tx.sessionNote.create({
        data: {
          coachId,
          memberId,
          sessionId: null,
          status: noteStatus,
          sessionType: sessionType || "Weekly Check-in",
        },
      });

      const version = await tx.sessionNoteVersion.create({
        data: {
          noteId: note.id,
          version: 1,
          summary: notes || "",
          keyThemes: [],
          memberSentiment: "Neutral",
          coachObservations: notes || "",
          riskFlag: false,
          riskNotes: "",
          recommendedFollowUp: nextSessionGoal || "",
          createdById: coachId,
        },
      });

      return { note, version };
    });

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true },
    });

    return res.status(201).json({
      note: {
        id: result.note.id,
        sessionId: null,
        coachId: result.note.coachId,
        memberId: result.note.memberId,
        clientName: member?.name || "",
        aiSessionNoteId: null,
        status: result.note.status,
        sessionType: result.note.sessionType || "Weekly Check-in",
        createdAt: result.note.createdAt.toISOString(),
        updatedAt: result.note.updatedAt.toISOString(),
        version: 1,
        summary: result.version.summary,
        keyThemes: [],
        memberSentiment: "Neutral",
        coachObservations: result.version.coachObservations,
        riskFlag: false,
        riskNotes: "",
        recommendedFollowUp: result.version.recommendedFollowUp,
      },
    });
  } catch (error) {
    console.error("[createManualSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateManualSessionNote = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const noteId = req.params.id;
    const { notes, nextSessionGoal, status, sessionType } = req.body as {
      notes?: string;
      nextSessionGoal?: string;
      status?: "draft" | "saved" | "DRAFT" | "FINAL";
      sessionType?: string;
    };

    const existing = await prisma.sessionNote.findUnique({
      where: { id: noteId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (existing.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    let noteStatus: "DRAFT" | "FINAL" = "DRAFT";
    if (status === "saved" || status === "FINAL") {
      noteStatus = "FINAL";
    }

    const result = await prisma.$transaction(async (tx) => {
      const latest = await tx.sessionNoteVersion.findFirst({
        where: { noteId },
        orderBy: { version: "desc" },
      });

      const nextVersion = latest ? latest.version + 1 : 1;

      const updatedNote = await tx.sessionNote.update({
        where: { id: noteId },
        data: {
          status: noteStatus,
          sessionType: sessionType || undefined,
          updatedAt: new Date(),
        },
      });

      const newVersion = await tx.sessionNoteVersion.create({
        data: {
          noteId,
          version: nextVersion,
          summary: notes !== undefined ? notes : (latest?.summary || ""),
          keyThemes: latest?.keyThemes || [],
          memberSentiment: latest?.memberSentiment || "Neutral",
          coachObservations: notes !== undefined ? notes : (latest?.coachObservations || ""),
          riskFlag: latest?.riskFlag || false,
          riskNotes: latest?.riskNotes || "",
          recommendedFollowUp: nextSessionGoal !== undefined ? nextSessionGoal : (latest?.recommendedFollowUp || ""),
          createdById: coachId,
        },
      });

      return { note: updatedNote, version: newVersion };
    });

    const member = await prisma.user.findUnique({
      where: { id: result.note.memberId },
      select: { name: true },
    });

    return res.status(200).json({
      note: {
        id: result.note.id,
        sessionId: result.note.sessionId,
        coachId: result.note.coachId,
        memberId: result.note.memberId,
        clientName: member?.name || "",
        aiSessionNoteId: result.note.aiSessionNoteId,
        status: result.note.status,
        sessionType: result.note.sessionType || "Weekly Check-in",
        createdAt: result.note.createdAt.toISOString(),
        updatedAt: result.note.updatedAt.toISOString(),
        version: result.version.version,
        summary: result.version.summary,
        keyThemes: result.version.keyThemes,
        memberSentiment: result.version.memberSentiment,
        coachObservations: result.version.coachObservations,
        riskFlag: result.version.riskFlag,
        riskNotes: result.version.riskNotes,
        recommendedFollowUp: result.version.recommendedFollowUp,
      },
    });
  } catch (error) {
    console.error("[updateManualSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteManualSessionNote = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId) return res.status(401).json({ message: "Unauthorized" });

    const noteId = req.params.id;
    const existing = await prisma.sessionNote.findUnique({
      where: { id: noteId },
    });

    if (!existing) {
      return res.status(404).json({ message: "Note not found" });
    }
    if (existing.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.sessionNote.delete({
      where: { id: noteId },
    });

    return res.status(200).json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("[deleteManualSessionNote]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
