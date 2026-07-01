import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { forwardChangeInsightToSentiment } from "../services/sentimentForwarder";

export const getChangeInsights = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let memberId: string | undefined;

    if (role === "member") {
      memberId = userId;
    } else if (role === "coach") {
      memberId = req.query.memberId as string;
      if (!memberId) {
        return res.status(400).json({ message: "Missing memberId parameter" });
      }
      // Verify coach is assigned to this member
      const assignment = await prisma.coachMember.findUnique({
        where: { coachId_userId: { coachId: userId, userId: memberId } },
      });
      if (!assignment) {
        return res.status(403).json({ message: "Forbidden: You are not assigned to this member" });
      }
    } else if (role === "superadmin") {
      memberId = req.query.memberId as string;
      if (!memberId) {
        return res.status(400).json({ message: "Missing memberId parameter" });
      }
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    const insights = await prisma.memberChangeInsight.findMany({
      where: { memberId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(insights);
  } catch (error) {
    console.error("[getChangeInsights]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const compareSessionNotes = async (req: Request, res: Response): Promise<Response> => {
  try {
    const coachId = req.user?.id;
    if (!coachId || req.user?.role !== "coach") {
      return res.status(403).json({ message: "Forbidden: Only coaches can trigger comparisons" });
    }

    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) {
      return res.status(400).json({ message: "Missing sessionId" });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (session.coachId !== coachId) {
      return res.status(403).json({ message: "Forbidden: You are not the coach of this session" });
    }

    // Check AI Clinical Analysis Consent
    const consent = await prisma.patientConsent.findFirst({
      where: {
        patientId: session.memberId,
        consentType: "ai_analysis",
        granted: true,
        revokedAt: null,
      },
    });
    if (!consent) {
      return res.status(200).json({
        status: "consent_withheld",
        message: "AI Clinical Analysis consent has not been granted by this member.",
      });
    }

    // Fetch Note B (current note)
    const noteB = await prisma.sessionNote.findUnique({
      where: { sessionId },
    });
    if (!noteB) {
      return res.status(404).json({ message: "Current session note not found" });
    }

    const latestVersionB = await prisma.sessionNoteVersion.findFirst({
      where: { noteId: noteB.id },
      orderBy: { version: "desc" },
    });
    if (!latestVersionB) {
      return res.status(404).json({ message: "No note content versions found for this session" });
    }

    // Fetch Note A (previous note - most recent finalized note created before Note B)
    const noteA = await prisma.sessionNote.findFirst({
      where: {
        memberId: session.memberId,
        status: "FINAL",
        id: { not: noteB.id },
        createdAt: { lt: noteB.createdAt },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!noteA) {
      return res.status(200).json({
        status: "no_previous_note",
        message: "No previous finalized note found for comparison.",
      });
    }

    const latestVersionA = await prisma.sessionNoteVersion.findFirst({
      where: { noteId: noteA.id },
      orderBy: { version: "desc" },
    });
    if (!latestVersionA) {
      return res.status(200).json({
        status: "no_previous_note",
        message: "No note content versions found for the previous session note.",
      });
    }

    // Call Python backend
    const pyBaseUrl = process.env.PYTHON_BACKEND_URL || "http://localhost:8001";
    console.log(`[compareSessionNotes] Calling Python backend at: ${pyBaseUrl}/v1/change-detection/compare`);

    const response = await fetch(`${pyBaseUrl}/v1/change-detection/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        noteA: {
          summary: latestVersionA.summary,
          keyThemes: latestVersionA.keyThemes,
          sentiment: latestVersionA.memberSentiment,
          coachObservations: latestVersionA.coachObservations,
          recommendedFollowUp: latestVersionA.recommendedFollowUp,
        },
        noteB: {
          summary: latestVersionB.summary,
          keyThemes: latestVersionB.keyThemes,
          sentiment: latestVersionB.memberSentiment,
          coachObservations: latestVersionB.coachObservations,
          recommendedFollowUp: latestVersionB.recommendedFollowUp,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[compareSessionNotes] Python API failed:", errText);
      return res.status(502).json({ message: "Python comparison service failed", details: errText });
    }

    const result = (await response.json()) as {
      summary: string;
      improvements: any;
      concerns: any;
      goals: any;
      behavioralPatterns: any;
      safetyFlags: any;
      hasSafetyAlert: boolean;
    };

    // Upsert MemberChangeInsight
    const existingInsight = await prisma.memberChangeInsight.findFirst({
      where: {
        sessionNoteIdA: noteA.id,
        sessionNoteIdB: noteB.id,
      },
    });

    let insight;
    if (existingInsight) {
      insight = await prisma.memberChangeInsight.update({
        where: { id: existingInsight.id },
        data: {
          summary: result.summary,
          improvements: result.improvements,
          concerns: result.concerns,
          goals: result.goals,
          behavioralPatterns: result.behavioralPatterns,
          safetyFlags: result.safetyFlags,
          hasSafetyAlert: result.hasSafetyAlert,
        },
      });
    } else {
      insight = await prisma.memberChangeInsight.create({
        data: {
          memberId: session.memberId,
          sessionNoteIdA: noteA.id,
          sessionNoteIdB: noteB.id,
          summary: result.summary,
          improvements: result.improvements,
          concerns: result.concerns,
          goals: result.goals,
          behavioralPatterns: result.behavioralPatterns,
          safetyFlags: result.safetyFlags,
          hasSafetyAlert: result.hasSafetyAlert,
        },
      });
    }

    let orgId = "org_default";
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.memberId },
        select: { organizationId: true },
      });
      if (user?.organizationId) {
        orgId = user.organizationId;
      }
    } catch (err) {
      console.warn("Failed to get member orgId in changeInsight controller:", err);
    }

    forwardChangeInsightToSentiment(insight, orgId);

    return res.status(200).json({ status: "success", insight });
  } catch (error) {
    console.error("[compareSessionNotes]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
