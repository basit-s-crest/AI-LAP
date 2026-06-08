import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { LiveKitService } from "../services/livekit.service";

/**
 * Helper to fetch a session and assert permission
 */
async function getValidatedSession(
  req: Request<{ id: string }>,
  res: Response
) {
  const { id } = req.params;
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id },
  });

  if (!session) {
    res.status(404).json({ message: "Session not found" });
    return null;
  }

  const isCoach = user.role === "coach" && session.coachId === user.id;
  const isMember = user.role === "member" && session.memberId === user.id;

  if (!isCoach && !isMember) {
    res.status(403).json({ message: "Forbidden: Not authorized to access this session" });
    return null;
  }

  return { session, isCoach, isMember, userId: user.id };
}

/**
 * POST /api/sessions/:id/livekit/start
 * Coach only: Starts the video room, sets the room name if null, updates start timestamp.
 */
export const startVideoSession = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response | void> => {
  try {
    const authContext = await getValidatedSession(req, res);
    if (!authContext) return;

    const { session, isCoach } = authContext;

    if (!isCoach) {
      return res.status(403).json({ message: "Forbidden: Only the assigned coach can start the call" });
    }

    if (session.status === "cancelled") {
      return res.status(409).json({ message: "Conflict: Cannot start a cancelled session" });
    }

    // Generate room name if it doesn't exist
    const roomName = session.livekitRoomName || `safecircle-session-${session.id}`;
    const startedAt = session.livekitStartedAt || new Date();

    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        livekitRoomName: roomName,
        livekitStartedAt: startedAt,
      },
    });

    const coach = await prisma.coach.findUnique({
      where: { id: session.coachId },
      select: { name: true },
    });

    const participantName = coach?.name || "Coach";
    const identity = `coach:${session.coachId}`;

    let tokenDetails;
    try {
      tokenDetails = await LiveKitService.generateToken(
        roomName,
        identity,
        participantName,
        session.duration
      );
    } catch (configError: any) {
      console.error("[startVideoSession] LiveKit Config Error:", configError.message);
      return res.status(503).json({ message: "LiveKit service is not configured on the server" });
    }

    const expiresAt = new Date(startedAt.getTime() + (session.duration + 15) * 60 * 1000);

    return res.status(200).json({
      sessionId: session.id,
      coachId: session.coachId,
      memberId: session.memberId,
      roomName,
      serverUrl: tokenDetails.serverUrl,
      token: tokenDetails.token,
      identity,
      role: "coach",
      participantName,
      scheduledAt: session.scheduledAt,
      livekitStartedAt: startedAt,
      expiresAt,
    });
  } catch (error) {
    console.error("[startVideoSession] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST /api/sessions/:id/livekit/token
 * Coach or Member: Fetch token for a session that has been started.
 */
export const getVideoToken = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response | void> => {
  try {
    const authContext = await getValidatedSession(req, res);
    if (!authContext) return;

    const { session, isCoach, isMember } = authContext;

    if (session.status === "cancelled") {
      return res.status(409).json({ message: "Conflict: Session is cancelled" });
    }

    if (!session.livekitStartedAt || !session.livekitRoomName) {
      return res.status(409).json({ message: "Conflict: Meeting has not been started by the coach yet" });
    }

    let participantName = "User";
    let identity = "";
    let role = "";

    if (isCoach) {
      const coach = await prisma.coach.findUnique({
        where: { id: session.coachId },
        select: { name: true },
      });
      participantName = coach?.name || "Coach";
      identity = `coach:${session.coachId}`;
      role = "coach";
    } else if (isMember) {
      const user = await prisma.user.findUnique({
        where: { id: session.memberId },
        select: { name: true },
      });
      participantName = user?.name || "Member";
      identity = `member:${session.memberId}`;
      role = "user";
    }

    let tokenDetails;
    try {
      tokenDetails = await LiveKitService.generateToken(
        session.livekitRoomName,
        identity,
        participantName,
        session.duration
      );
    } catch (configError: any) {
      console.error("[getVideoToken] LiveKit Config Error:", configError.message);
      return res.status(503).json({ message: "LiveKit service is not configured on the server" });
    }

    const expiresAt = new Date(
      session.livekitStartedAt.getTime() + (session.duration + 15) * 60 * 1000
    );

    return res.status(200).json({
      sessionId: session.id,
      coachId: session.coachId,
      memberId: session.memberId,
      roomName: session.livekitRoomName,
      serverUrl: tokenDetails.serverUrl,
      token: tokenDetails.token,
      identity,
      role,
      participantName,
      scheduledAt: session.scheduledAt,
      livekitStartedAt: session.livekitStartedAt,
      expiresAt,
    });
  } catch (error) {
    console.error("[getVideoToken] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * GET /api/sessions/:id/livekit/status
 * Coach or Member: Retrieve status mapping of the room.
 */
export const getVideoStatus = async (
  req: Request<{ id: string }>,
  res: Response
): Promise<Response | void> => {
  try {
    const authContext = await getValidatedSession(req, res);
    if (!authContext) return;

    const { session } = authContext;

    return res.status(200).json({
      sessionId: session.id,
      coachId: session.coachId,
      memberId: session.memberId,
      roomName: session.livekitRoomName,
      livekitStartedAt: session.livekitStartedAt,
      livekitEndedAt: session.livekitEndedAt,
      status: session.status,
    });
  } catch (error) {
    console.error("[getVideoStatus] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
