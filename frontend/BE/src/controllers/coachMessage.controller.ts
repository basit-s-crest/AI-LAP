import { Request, Response } from "express";
import prisma from "../lib/prisma";
import {
  getThread,
  markRead,
  getConversationList,
  toCoachMessageDTO,
} from "../services/coachMessage.service";
import { queryMessageRiskData } from "../lib/vaslDb";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RiskTier = "low" | "moderate" | "high" | "crisis";

function tierToLabel(tier: RiskTier | null): string | null {
  if (!tier) return null;
  const map: Record<RiskTier, string> = {
    low:      "Low Risk",
    moderate: "Moderate",
    high:     "High Risk",
    crisis:   "Crisis",
  };
  return map[tier] ?? null;
}

export interface MessageRiskData {
  risk_tier: RiskTier;
  risk_score: number;
  signal_codes: string[];
}

/**
 * Batch-fetch risk data from the vasl DB for coach message ids.
 * Returns a map of messageId → { risk_tier, risk_score, signal_codes }.
 */
async function fetchRiskData(
  messageIds: string[]
): Promise<Record<string, MessageRiskData>> {
  if (messageIds.length === 0) return {};
  try {
    const rows = await queryMessageRiskData(messageIds);
    const map: Record<string, MessageRiskData> = {};
    for (const row of rows) {
      if (!row.original_source_id) continue;
      map[row.original_source_id] = {
        risk_tier: row.risk_tier as RiskTier,
        risk_score: row.risk_score,
        signal_codes: row.signal_codes ?? [],
      };
    }
    return map;
  } catch (err) {
    console.error("[fetchRiskData]", err);
    return {};
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

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
    const baseDTOs = page.messages.map(toCoachMessageDTO);

    // Only enrich member messages with risk data
    const memberMessageIds = baseDTOs
      .filter((m) => m.senderRole === "member")
      .map((m) => m.id);

    const riskMap = await fetchRiskData(memberMessageIds);

    const enriched = baseDTOs.map((msg) => {
      if (msg.senderRole !== "member") {
        return {
          ...msg,
          risk_tier: null,
          risk_score: null,
          risk_label: null,
          signal_codes: null,
        };
      }
      const risk = riskMap[msg.id] ?? null;
      return {
        ...msg,
        risk_tier:  risk?.risk_tier  ?? null,
        risk_score: risk?.risk_score ?? null,
        risk_label: tierToLabel(risk?.risk_tier ?? null),
        signal_codes: risk?.signal_codes ?? null,
      };
    });

    return res.status(200).json({
      messages: enriched,
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

/** GET /api/coach-messages/unread-count — unread messages for the authenticated user. */
export const getUnreadCountHandler = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { id, role } = req.user;
    if (role === "member") {
      const count = await prisma.coachMessage.count({
        where: { userId: id, senderRole: "coach", read: false },
      });
      return res.status(200).json({ count });
    }
    if (role === "coach") {
      const count = await prisma.coachMessage.count({
        where: { coachId: id, senderRole: "member", read: false },
      });
      return res.status(200).json({ count });
    }
    return res.status(403).json({ message: "Forbidden" });
  } catch (error) {
    console.error("[getUnreadCountHandler]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
