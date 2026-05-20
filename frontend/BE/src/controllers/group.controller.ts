import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { forwardPeerPostToSentiment } from "../services/sentimentForwarder";

export const getGroups = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;

    const groups = await prisma.communityGroup.findMany({
      where: { status: { not: "archived" } },
      orderBy: { createdAt: "desc" },
      include: {
        memberships: {
          where: { memberId: userId, isActive: true },
        },
        _count: {
          select: {
            memberships: { where: { isActive: true } },
            posts: true,
          },
        },
      },
    });

    return res.status(200).json(
      groups.map((group) => ({
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        desc: group.description ?? "",
        color: group.color,
        tags: group.tags,
        mod: group.mod ?? "",
        status: group.status,
        members: group._count.memberships,
        posts: group._count.posts,
        joined: group.memberships.length > 0,
      }))
    );
  } catch (error) {
    
    console.log("1")
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getGroupById = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;

    const group = await prisma.communityGroup.findUnique({
      where: { id: req.params.id },
      include: {
        memberships: {
          where: { memberId: userId, isActive: true },
        },
        _count: {
          select: {
            memberships: { where: { isActive: true } },
            posts: true,
          },
        },
        posts: {
          where: { isFlagged: false },
          orderBy: { createdAt: "desc" },
          include: {
            member: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (group.status === "archived") {
      return res.status(404).json({ message: "Group not found" });
    }

    return res.status(200).json({
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      desc: group.description ?? "",
      color: group.color,
      tags: group.tags,
      mod: group.mod ?? "",
      status: group.status,
      members: group._count.memberships,
      posts: group.posts.map((p) => ({
        id: p.id,
        author: p.member.name,
        memberId: p.memberId,
        body: p.body,
        replyCount: p.replyCount,
        supportCount: p.supportCount,
        isFlagged: p.isFlagged,
        time: p.createdAt,
      })),
      joined: group.memberships.length > 0,
    });
  } catch (error) {
    
    console.log("3")
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const joinGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;
    const groupId = req.params.id;

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
    });
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.status === "archived") {
      return res.status(403).json({ message: "Archived groups cannot be joined" });
    }

    await prisma.groupMembership.upsert({
      where: { memberId_groupId: { memberId: userId, groupId } },
      update: { isActive: true },
      create: { memberId: userId, groupId, isActive: true },
    });

    return res.status(200).json({ message: "Joined group", joined: true });
  } catch (error) {
    
    console.log("4")
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const leaveGroup = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;
    const groupId = req.params.id;

    const membership = await prisma.groupMembership.findUnique({
      where: { memberId_groupId: { memberId: userId, groupId } },
    });
    if (!membership) {
      return res.status(404).json({ message: "Membership not found" });
    }

    await prisma.groupMembership.update({
      where: { memberId_groupId: { memberId: userId, groupId } },
      data: { isActive: false },
    });

    return res.status(200).json({ message: "Left group", joined: false });
  } catch (error) {
    
    console.log("5")
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
        memberIds: [],
      },
    });
    return res.status(201).json(group);
  } catch (error) {
    
    console.log("6")
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createPost = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;
    const groupId = req.params.id;
    const { body } = req.body;

    if (!body?.trim()) {
      return res.status(400).json({ message: "Post body is required" });
    }

    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId },
      select: { status: true },
    });

    if (!group || group.status === "archived") {
      return res.status(404).json({ message: "Group not found" });
    }

    const membership = await prisma.groupMembership.findUnique({
      where: { memberId_groupId: { memberId: userId, groupId } },
    });

    if (!membership || !membership.isActive) {
      return res.status(403).json({ message: "Join the group before posting" });
    }

    const post = await prisma.peerGroupPost.create({
      data: { groupId, memberId: userId, body: body.trim() },
      include: { member: { select: { id: true, name: true } } },
    });

    // Fire-and-forget: forward post text to Python sentiment backend
    forwardPeerPostToSentiment(post);

    return res.status(201).json({
      id: post.id,
      author: post.member.name,
      memberId: post.memberId,
      body: post.body,
      replyCount: post.replyCount,
      supportCount: post.supportCount,
      isFlagged: post.isFlagged,
      time: post.createdAt,
    });
  } catch (error) {
    
    console.log("9")
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getMyGroups = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;

    const memberships = await prisma.groupMembership.findMany({
      where: { memberId: userId, isActive: true },
      include: {
        group: {
          include: {
            _count: {
              select: {
                memberships: { where: { isActive: true } },
                posts: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return res.status(200).json(
      memberships
        .filter((m) => m.group.status !== "archived")
        .map((m) => ({
          id: m.group.id,
          name: m.group.name,
          emoji: m.group.emoji,
          desc: m.group.description ?? "",
          color: m.group.color,
          tags: m.group.tags,
          mod: m.group.mod ?? "",
          status: m.group.status,
          members: m.group._count.memberships,
          posts: m.group._count.posts,
          joined: true,
        }))
    );
  } catch (error) {
    console.error("[getMyGroups]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getRecentPosts = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const groupIds = (
      await prisma.groupMembership.findMany({
        where: { memberId: userId, isActive: true },
        select: { groupId: true },
      })
    ).map((m) => m.groupId);

    if (groupIds.length === 0) {
      return res.status(200).json([]);
    }

    const posts = await prisma.peerGroupPost.findMany({
      where: {
        groupId: { in: groupIds },
        isFlagged: false,
        createdAt: { gte: since },
        memberId: { not: userId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, emoji: true } },
      },
      take: 20,
    });

    return res.status(200).json(
      posts.map((p) => ({
        id: p.id,
        groupId: p.groupId,
        groupName: p.group.name,
        groupEmoji: p.group.emoji,
        memberName: p.member.name,
        body: p.body,
        createdAt: p.createdAt,
      }))
    );
  } catch (error) {
    console.error("[getRecentPosts]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getRecentJoins = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = req.user.id;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const groupIds = (
      await prisma.groupMembership.findMany({
        where: { memberId: userId, isActive: true },
        select: { groupId: true },
      })
    ).map((m) => m.groupId);

    if (groupIds.length === 0) {
      return res.status(200).json([]);
    }

    const joins = await prisma.groupMembership.findMany({
      where: {
        groupId: { in: groupIds },
        isActive: true,
        joinedAt: { gte: since },
        memberId: { not: userId },
      },
      orderBy: { joinedAt: "desc" },
      include: {
        member: { select: { id: true, name: true } },
        group: { select: { id: true, name: true, emoji: true } },
      },
      take: 20,
    });

    return res.status(200).json(
      joins.map((j) => ({
        id: j.id,
        groupId: j.groupId,
        groupName: j.group.name,
        groupEmoji: j.group.emoji,
        memberName: j.member.name,
        joinedAt: j.joinedAt,
      }))
    );
  } catch (error) {
    console.error("[getRecentJoins]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getPosts = async (req: Request, res: Response): Promise<Response> => {
  try {
    const posts = await prisma.peerGroupPost.findMany({
      where: { groupId: req.params.id, isFlagged: false },
      orderBy: { createdAt: "desc" },
      include: { member: { select: { id: true, name: true } } },
    });

    return res.status(200).json(
      posts.map((p) => ({
        id: p.id,
        author: p.member.name,
        memberId: p.memberId,
        body: p.body,
        replyCount: p.replyCount,
        supportCount: p.supportCount,
        isFlagged: p.isFlagged,
        time: p.createdAt,
      }))
    );
  } catch (error) {
    console.log("10")
    return res.status(500).json({ message: "Internal server error" });
  }
};
