import { Request, Response } from "express";

import prisma from "../lib/prisma";

export const getGroups = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const groups = await prisma.communityGroup.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(
      groups.map((group) => ({
        ...group,
        joined: group.memberIds.includes(userId),
      }))
    );
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getGroupById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const group = await prisma.communityGroup.findUnique({
      where: { id: req.params.id as string },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    return res.status(200).json({ ...group, posts: [] });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const joinGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const group = await prisma.communityGroup.findUnique({
      where: { id: req.params.id as string },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.memberIds.includes(userId)) {
      return res.status(200).json(group);
    }

    const updatedGroup = await prisma.communityGroup.update({
      where: { id: group.id },
      data: {
        memberIds: [...group.memberIds, userId],
      },
    });

    return res.status(200).json(updatedGroup);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user.id;
    const group = await prisma.communityGroup.findUnique({
      where: { id: req.params.id as string },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const updatedGroup = await prisma.communityGroup.update({
      where: { id: group.id },
      data: {
        memberIds: group.memberIds.filter((id) => id !== userId),
      },
    });

    return res.status(200).json(updatedGroup);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id || !req.user.role) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!["admin", "coach"].includes(req.user.role.toLowerCase())) {
      return res.status(403).json({ message: "Only admin/coach can create groups" });
    }

    const { name, emoji, description, color, tags, mod } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const group = await prisma.communityGroup.create({
      data: {
        name,
        emoji: emoji ?? "👥",
        description: description ?? null,
        color: color ?? "#4E8C58",
        tags: Array.isArray(tags) ? tags : [],
        mod: mod ?? null,
        memberIds: [req.user.id],
      },
    });

    return res.status(201).json(group);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};
