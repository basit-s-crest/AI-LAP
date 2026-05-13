import { Request, Response } from "express";
import {
  getThread,
  markRead,
  getConversationList,
  toCoachMessageDTO,
} from "../services/coachMessage.service";

export const getThreadHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const partnerId = req.params.partnerId as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const { id, role } = req.user;
    if (role !== "member" && role !== "coach") {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    const userId = role === "member" ? id : partnerId;
    const coachId = role === "coach" ? id : partnerId;

    const page = await getThread(userId, coachId, cursor, limit);

    return res.status(200).json({
      messages: page.messages.map(toCoachMessageDTO),
      nextCursor: page.nextCursor,
    });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const markReadHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const partnerId = req.params.partnerId as string;
    const { id, role } = req.user;
    if (role !== "member" && role !== "coach") {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }

    const updated = await markRead(id, role, partnerId);

    return res.status(200).json({ updated });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getConversationListHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id, role } = req.user;
    if (role !== "member" && role !== "coach") {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    const conversations = await getConversationList(id, role);

    return res.status(200).json(conversations);
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
};
