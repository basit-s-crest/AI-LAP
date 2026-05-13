"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.sendMessage = exports.getMessages = exports.getConversations = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getConversations = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const userId = req.user.id;
        const messages = await prisma_1.default.message.findMany({
            where: {
                OR: [{ senderId: userId }, { receiverId: userId }],
            },
            orderBy: { createdAt: "desc" },
            include: {
                sender: {
                    select: { id: true, name: true },
                },
                receiver: {
                    select: { id: true, name: true },
                },
            },
        });
        const map = new Map();
        for (const msg of messages) {
            const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
            const conversation = map.get(otherUser.id);
            if (!conversation) {
                map.set(otherUser.id, {
                    userId: otherUser.id,
                    name: otherUser.name,
                    lastMessage: msg.content,
                    time: msg.createdAt,
                    unread: msg.receiverId === userId && !msg.read ? 1 : 0,
                });
            }
            else if (msg.receiverId === userId && !msg.read) {
                conversation.unread += 1;
            }
        }
        return res.status(200).json(Array.from(map.values()));
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getConversations = getConversations;
const getMessages = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const myUserId = req.user.id;
        const otherUserId = req.params.userId;
        const messages = await prisma_1.default.message.findMany({
            where: {
                OR: [
                    { senderId: myUserId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: myUserId },
                ],
            },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                senderId: true,
                receiverId: true,
                content: true,
                read: true,
                createdAt: true,
            },
        });
        return res.status(200).json(messages);
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.getMessages = getMessages;
const sendMessage = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const senderId = req.user.id;
        const { receiverId, content } = req.body;
        if (!receiverId || !content) {
            return res.status(400).json({ message: "receiverId and content are required" });
        }
        const message = await prisma_1.default.message.create({
            data: {
                senderId,
                receiverId,
                content,
            },
        });
        return res.status(201).json(message);
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.sendMessage = sendMessage;
const markAsRead = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const myUserId = req.user.id;
        const otherUserId = req.params.userId;
        const updated = await prisma_1.default.message.updateMany({
            where: {
                senderId: otherUserId,
                receiverId: myUserId,
                read: false,
            },
            data: { read: true },
        });
        return res.status(200).json({ updated: updated.count });
    }
    catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
exports.markAsRead = markAsRead;
