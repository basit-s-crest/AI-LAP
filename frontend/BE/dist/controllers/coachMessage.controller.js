"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConversationListHandler = exports.markReadHandler = exports.getThreadHandler = void 0;
const coachMessage_service_1 = require("../services/coachMessage.service");
const getThreadHandler = async (req, res) => {
    try {
        if (!req.user)
            return res.status(401).json({ message: "Unauthorized" });
        const partnerId = req.params.partnerId;
        const cursor = req.query.cursor;
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const { id, role } = req.user;
        const userId = role === "member" ? id : partnerId;
        const coachId = role === "coach" ? id : partnerId;
        const page = await (0, coachMessage_service_1.getThread)(userId, coachId, cursor, limit);
        return res.status(200).json({
            messages: page.messages.map(coachMessage_service_1.toCoachMessageDTO),
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
        const conversations = await (0, coachMessage_service_1.getConversationList)(id, role);
        return res.status(200).json(conversations);
    }
    catch {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getConversationListHandler = getConversationListHandler;
