import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { hashPassword } from "../services/auth.service";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type IdParam = {
  id: string;
};

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

export const getAllUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          not: "superadmin",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            groupMemberships: {
              where: {
                isActive: true,
              },
            },
            sentMessages: true,
          },
        },
      },
    });

    return res.status(200).json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatar: u.avatar,
        isVerified: u.isVerified,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        groupCount: u._count.groupMemberships,
        messageCount: u._count.sentMessages,
      }))
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const getUserById = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.params.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        groupMemberships: {
          where: {
            isActive: true,
          },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                emoji: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const updateUser = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const {
      name,
      email,
      role,
      isVerified,
    } = req.body;

    const allowedRoles = [
      "member",
      "coach",
      "superadmin",
    ];

    const updatedData: any = {};

    if (name) updatedData.name = name;
    if (email) updatedData.email = email;

    if (
      role &&
      allowedRoles.includes(role)
    ) {
      updatedData.role = role;
    }

    if (isVerified !== undefined) {
      updatedData.isVerified = isVerified;
    }

    const user = await prisma.user.update({
      where: {
        id: req.params.id,
      },
      data: updatedData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(user);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const deleteUser = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    await prisma.user.delete({
      where: {
        id: req.params.id,
      },
    });

    return res.status(200).json({
      message: "User deleted",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ─── SUPERADMIN MANAGEMENT ────────────────────────────────────────────────────

export const createSuperAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      email,
      name,
      password,
      avatar,
    } = req.body;

    if (
      !email ||
      !name ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Email, name and password required",
      });
    }

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        message:
          "User already exists",
      });
    }

    const hashedPassword =
      await hashPassword(password);

    const superadmin =
      await prisma.user.create({
        data: {
          email,
          name,
          password: hashedPassword,
          avatar: avatar ?? null,
          role: "superadmin",
          isVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          isVerified: true,
          createdAt: true,
        },
      });

    return res.status(201).json(
      superadmin
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ─── COACH MANAGEMENT ─────────────────────────────────────────────────────────

export const getAllCoaches = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coaches =
      await prisma.coach.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
      });

    return res.status(200).json(
      coaches.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        avatar: c.avatar,
        bio: c.bio,
        speciality: c.speciality,
        isActive: c.isActive,
        createdAt: c.createdAt,
        memberCount: c._count.members,
      }))
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const createCoach = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      email,
      name,
      password,
      bio,
      speciality,
      avatar,
    } = req.body;

    if (
      !email ||
      !name ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Email, name and password required",
      });
    }

    const exists =
      await prisma.coach.findUnique({
        where: {
          email,
        },
      });

    if (exists) {
      return res.status(409).json({
        message:
          "Coach email already exists",
      });
    }

    const hashedPassword =
      await hashPassword(password);

    const coach =
      await prisma.coach.create({
        data: {
          email,
          name,
          password: hashedPassword,
          bio: bio ?? null,
          speciality:
            speciality ?? null,
          avatar: avatar ?? null,
          isActive: true,
        },
      });

    return res.status(201).json({
      id: coach.id,
      email: coach.email,
      name: coach.name,
      bio: coach.bio,
      speciality:
        coach.speciality,
      avatar: coach.avatar,
      isActive: coach.isActive,
      createdAt: coach.createdAt,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const updateCoach = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const {
      name,
      email,
      bio,
      speciality,
      avatar,
      isActive,
    } = req.body;

    const coach =
      await prisma.coach.update({
        where: {
          id: req.params.id,
        },
        data: {
          ...(name && { name }),
          ...(email && { email }),
          ...(bio !== undefined && {
            bio,
          }),
          ...(speciality !==
            undefined && {
            speciality,
          }),
          ...(avatar !== undefined && {
            avatar,
          }),
          ...(isActive !== undefined && {
            isActive,
          }),
        },
      });

    return res.status(200).json(
      coach
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const removeCoach = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    await prisma.coach.update({
      where: {
        id: req.params.id,
      },
      data: {
        isActive: false,
      },
    });

    return res.status(200).json({
      message: "Coach removed",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// ─── GROUP MANAGEMENT ─────────────────────────────────────────────────────────

export const adminGetGroups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const groups =
      await prisma.communityGroup.findMany({
        orderBy: {
          createdAt: "desc",
        },
        include: {
          _count: {
            select: {
              memberships: {
                where: {
                  isActive: true,
                },
              },
              posts: true,
            },
          },
        },
      });

    return res.status(200).json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        description: g.description,
        color: g.color,
        tags: g.tags,
        mod: g.mod,
        status: g.status,
        memberCount:
          g._count.memberships,
        postCount:
          g._count.posts,
        createdAt: g.createdAt,
      }))
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const adminCreateGroup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      name,
      emoji,
      description,
      color,
      tags,
      mod,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Name required",
      });
    }

    const group =
      await prisma.communityGroup.create({
        data: {
          name,
          emoji: emoji ?? "👥",
          description:
            description ?? null,
          color:
            color ?? "#4E8C58",
          tags: Array.isArray(tags)
            ? tags
            : [],
          mod: mod ?? null,
          memberIds: [],
          status: "active",
        },
      });

    return res.status(201).json(
      group
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const adminUpdateGroup = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const {
      name,
      emoji,
      description,
      color,
      tags,
      mod,
      status,
    } = req.body;

    const group =
      await prisma.communityGroup.update({
        where: {
          id: req.params.id,
        },
        data: {
          ...(name && { name }),
          ...(emoji && { emoji }),
          ...(description !==
            undefined && {
            description,
          }),
          ...(color && { color }),
          ...(tags && { tags }),
          ...(mod !== undefined && {
            mod,
          }),
          ...(status && {
            status,
          }),
        },
      });

    return res.status(200).json(
      group
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

export const adminArchiveGroup = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const group =
      await prisma.communityGroup.update({
        where: {
          id: req.params.id,
        },
        data: {
          status: "archived",
        },
      });

    return res.status(200).json(
      group
    );
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};