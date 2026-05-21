"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnreadCountHandler = exports.getConversationListHandler = exports.markReadHandler = exports.getThreadHandler = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const coachMessage_service_1 = require("../services/coachMessage.service");
const vaslDb_1 = require("../lib/vaslDb");
function tierToLabel(tier) {
    if (!tier)
        return null;
    const map = {
        low: "Low Risk",
        moderate: "Moderate",
        high: "High Risk",
        crisis: "Crisis",
    };
    return map[tier] ?? null;
}
/**
 * Batch-fetch risk data from the vasl DB for coach message ids.
 * Returns a map of messageId → { risk_tier, risk_score, signal_codes }.
 */
async function fetchRiskData(messageIds) {
    if (messageIds.length === 0)
        return {};
    try {
        const rows = await (0, vaslDb_1.queryMessageRiskData)(messageIds);
        const map = {};
        for (const row of rows) {
            if (!row.original_source_id)
                continue;
            map[row.original_source_id] = {
                risk_tier: row.risk_tier,
                risk_score: row.risk_score,
                signal_codes: row.signal_codes ?? [],
            };
        }
        return map;
    }
    catch (err) {
        console.error("[fetchRiskData]", err);
        return {};
    }
}
// ─── Handlers ─────────────────────────────────────────────────────────────────
const getThreadHandler = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const partnerId = req.params.partnerId;
        const cursor = req.query.cursor;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const { id, role } = req.user;
        if (role !== "member" && role !== "coach") {
            return res.status(403).json({ message: "Forbidden: insufficient role" });
        }
        const userId = role === "member" ? id : partnerId;
        const coachId = role === "coach" ? id : partnerId;
        const page = await (0, coachMessage_service_1.getThread)(userId, coachId, cursor, limit);
        const baseDTOs = page.messages.map(coachMessage_service_1.toCoachMessageDTO);
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
                risk_tier: risk?.risk_tier ?? null,
                risk_score: risk?.risk_score ?? null,
                risk_label: tierToLabel(risk?.risk_tier ?? null),
                signal_codes: risk?.signal_codes ?? null,
            };
        });
        return res.status(200).json({
            messages: enriched,
            nextCursor: page.nextCursor,
        });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getThreadHandler = getThreadHandler;
const markReadHandler = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const partnerId = req.params.partnerId;
        const { id, role } = req.user;
        if (role !== "member" && role !== "coach") {
            return res.status(403).json({ message: "Forbidden: insufficient role" });
        }
        const updated = await (0, coachMessage_service_1.markRead)(id, role, partnerId);
        return res.status(200).json({ updated });
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.markReadHandler = markReadHandler;
const getConversationListHandler = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { id, role } = req.user;
        if (role !== "member" && role !== "coach") {
            return res.status(403).json({ message: "Forbidden: insufficient role" });
        }
        const conversations = await (0, coachMessage_service_1.getConversationList)(id, role);
        return res.status(200).json(conversations);
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getConversationListHandler = getConversationListHandler;
/** GET /api/coach-messages/unread-count — unread messages for the authenticated user. */
const getUnreadCountHandler = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const { id, role } = req.user;
        if (role === "member") {
            const count = await prisma_1.default.coachMessage.count({
                where: { userId: id, senderRole: "coach", read: false },
            });
            return res.status(200).json({ count });
        }
        if (role === "coach") {
            const count = await prisma_1.default.coachMessage.count({
                where: { coachId: id, senderRole: "member", read: false },
            });
            return res.status(200).json({ count });
        }
        return res.status(403).json({ message: "Forbidden" });
    }
    catch (error) {
        console.error("[getUnreadCountHandler]", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getUnreadCountHandler = getUnreadCountHandler;
