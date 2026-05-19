import { Request, Response } from "express";

import prisma from "../lib/prisma";

export const getConversations = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;

    const messages = await prisma.message.findMany({
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

    const map = new Map<
      string,
      { userId: string; name: string; lastMessage: string; time: Date; unread: number }
    >();

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
      } else if (msg.receiverId === userId && !msg.read) {
        conversation.unread += 1;
      }
    }

    return res.status(200).json(Array.from(map.values()));
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const myUserId = req.user.id;
    const otherUserId = req.params.userId as string;

    // Pagination params
    const limit = Math.min(parseInt((req.query.limit as string) ?? "10", 10), 50);
    const cursor = req.query.cursor as string | undefined;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: myUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: myUserId },
        ],
        // If cursor provided, fetch messages OLDER than that message
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" }, // newest first, we'll reverse on frontend
      take: limit + 1, // fetch one extra to know if there's a next page
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        content: true,
        read: true,
        createdAt: true,
      },
    });

    // Check if there are more older messages
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop(); // remove the extra one

    // nextCursor = createdAt of the oldest message in this batch
    const nextCursor = hasMore
      ? messages[messages.length - 1].createdAt.toISOString()
      : null;

    return res.status(200).json({
      messages,   // newest-first; hook will reverse to oldest-first for display
      nextCursor,
    });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const senderId = req.user.id;
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ message: "receiverId and content are required" });
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
      },
    });

    return res.status(201).json(message);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const markAsRead = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const myUserId = req.user.id;
    const otherUserId = req.params.userId as string;

    const updated = await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: myUserId,
        read: false,
      },
      data: { read: true },
    });

    return res.status(200).json({ updated: updated.count });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
