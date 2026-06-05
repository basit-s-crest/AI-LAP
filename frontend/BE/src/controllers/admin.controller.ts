import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { hashPassword } from "../services/auth.service";
import { notifyOrganizationMemberJoined } from "../services/notificationEmail.service";

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
        lastActiveAt: true,
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
        organizationId: true,
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
        lastActiveAt: u.lastActiveAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        groupCount: u._count.groupMemberships,
        messageCount: u._count.sentMessages,
        organizationId: u.organizationId,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getUserById = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
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
          where: { isActive: true },
          include: {
            group: {
              select: { id: true, name: true, emoji: true },
            },
          },
        },
        organizationId: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createUser = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { email, name, password, avatar, role, isVerified, organizationId } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ message: "Email, name and password are required" });
    }

    const allowedRoles = ["member", "superadmin"];
    const userRole = allowedRoles.includes(role) ? role : "member";

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        avatar: avatar ?? null,
        role: userRole,
        isVerified: isVerified ?? true,
        organizationId: organizationId ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isVerified: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            groupMemberships: { where: { isActive: true } },
            sentMessages: true,
          },
        },
        organizationId: true,
      },
    });

    if (user.organizationId) {
      void notifyOrganizationMemberJoined(user.organizationId, user.id);
    }

    return res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      isVerified: user.isVerified,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      groupCount: user._count.groupMemberships,
      messageCount: user._count.sentMessages,
      organizationId: user.organizationId,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateUser = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const { name, email, role, isVerified, organizationId } = req.body;

    const allowedRoles = ["member", "coach", "superadmin"];
    const updatedData: any = {};

    if (name) updatedData.name = name;
    if (email) updatedData.email = email;
    if (role && allowedRoles.includes(role)) updatedData.role = role;
    if (isVerified !== undefined) updatedData.isVerified = isVerified;
    if (organizationId !== undefined) {
      updatedData.organizationId = organizationId === "" ? null : organizationId;
    }

    const prior =
      organizationId !== undefined
        ? await prisma.user.findUnique({
            where: { id: req.params.id },
            select: { organizationId: true },
          })
        : null;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updatedData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
    });

    const newOrgId =
      organizationId !== undefined && organizationId !== ""
        ? organizationId
        : null;
    if (newOrgId && prior && !prior.organizationId) {
      void notifyOrganizationMemberJoined(newOrgId, user.id);
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteUser = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    return res.status(200).json({ message: "User deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── COACH MANAGEMENT ─────────────────────────────────────────────────────────

export const getAllCoaches = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const coaches = await prisma.coach.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true } },
        orgAssignments: {
          include: {
            organization: { select: { id: true, name: true } },
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
        organizations: c.orgAssignments.map((a) => ({
          id: a.organization.id,
          name: a.organization.name,
        })),
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const createCoach = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { email, name, password, bio, speciality, avatar, organizationIds } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ message: "Email, name and password required" });
    }

    const exists = await prisma.coach.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ message: "Coach email already exists" });
    }

    const hashedPassword = await hashPassword(password);

    const coach = await prisma.coach.create({
      data: {
        email,
        name,
        password: hashedPassword,
        bio: bio ?? null,
        speciality: speciality ?? null,
        avatar: avatar ?? null,
        isActive: true,
      },
    });

    // Assign organizations if provided
    if (Array.isArray(organizationIds) && organizationIds.length > 0) {
      await prisma.organizationCoach.createMany({
        data: organizationIds.map((orgId: string) => ({
          coachId: coach.id,
          organizationId: orgId,
        })),
        skipDuplicates: true,
      });
    }

    // Fetch org assignments to return
    const orgAssignments = await prisma.organizationCoach.findMany({
      where: { coachId: coach.id },
      include: { organization: { select: { id: true, name: true } } },
    });

    return res.status(201).json({
      id: coach.id,
      email: coach.email,
      name: coach.name,
      bio: coach.bio,
      speciality: coach.speciality,
      avatar: coach.avatar,
      isActive: coach.isActive,
      createdAt: coach.createdAt,
      organizations: orgAssignments.map((a) => ({
        id: a.organization.id,
        name: a.organization.name,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateCoach = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const { name, email, bio, speciality, avatar, isActive, organizationIds } = req.body;

    const coach = await prisma.coach.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(bio !== undefined && { bio }),
        ...(speciality !== undefined && { speciality }),
        ...(avatar !== undefined && { avatar }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Sync org assignments if provided
    if (Array.isArray(organizationIds)) {
      await prisma.organizationCoach.deleteMany({ where: { coachId: req.params.id } });
      if (organizationIds.length > 0) {
        await prisma.organizationCoach.createMany({
          data: organizationIds.map((orgId: string) => ({
            coachId: req.params.id,
            organizationId: orgId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Fetch updated org assignments to return
    const orgAssignments = await prisma.organizationCoach.findMany({
      where: { coachId: req.params.id },
      include: { organization: { select: { id: true, name: true } } },
    });

    return res.status(200).json({
      ...coach,
      organizations: orgAssignments.map((a) => ({
        id: a.organization.id,
        name: a.organization.name,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const removeCoach = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    await prisma.coach.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    return res.status(200).json({ message: "Coach removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── GROUP MANAGEMENT ─────────────────────────────────────────────────────────

export const adminGetGroups = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const groups = await prisma.communityGroup.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            memberships: { where: { isActive: true } },
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
        tags: g.tags,
        mod: g.mod,
        status: g.status,
        memberCount: g._count.memberships,
        postCount: g._count.posts,
        createdAt: g.createdAt,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminCreateGroup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name, emoji, tags, mod } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name required" });
    }

    const group = await prisma.communityGroup.create({
      data: {
        name,
        emoji: emoji ?? "👥",
        tags: Array.isArray(tags) ? tags : [],
        mod: mod ?? null,
        status: "active",
      },
    });

    return res.status(201).json(group);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminUpdateGroup = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const { name, emoji, tags, mod, status } = req.body;

    const group = await prisma.communityGroup.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(emoji && { emoji }),
        ...(tags && { tags }),
        ...(mod !== undefined && { mod }),
        ...(status && { status }),
      },
    });

    return res.status(200).json(group);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminArchiveGroup = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const group = await prisma.communityGroup.update({
      where: { id: req.params.id },
      data: { status: "archived" },
    });
    return res.status(200).json(group);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── ORGANIZATION MANAGEMENT ──────────────────────────────────────────────────

export const adminGetOrgStats = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const [totalPartners, totalMembers, totalCoaches, spendAgg] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count({ where: { organizationId: { not: null } } }),
      // ✅ counts unique coaches
      prisma.organizationCoach.findMany({
        select: { coachId: true },
        distinct: ["coachId"],
      }).then(r => r.length),
      prisma.organization.aggregate({ _sum: { monthlySpend: true } }),
    ]);

    return res.status(200).json({
      totalPartners,
      totalMembers,
      totalMRR: spendAgg._sum.monthlySpend ?? 0,
      totalCoaches,
    });
  } catch (error) {
    console.error("[adminGetOrgStats]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetOrgs = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { members: true } },
        members: { select: { isVerified: true } },
        coachAssignments: {
          include: {
            coach: {
              select: { id: true, name: true, email: true, speciality: true, isActive: true },
            },
          },
        },
      },
    });

    return res.status(200).json(
      orgs.map((o) => {
        const totalMembers = o._count.members;
        const activeMembers = o.members.filter((m) => m.isVerified).length;
        const activeRate = totalMembers > 0 ? Math.round((activeMembers / totalMembers) * 100) : 0;
        return {
          id: o.id,
          name: o.name,
          type: o.type,
          plan: o.plan,
          status: o.status,
          primaryContactName: o.primaryContactName,
          primaryContactEmail: o.primaryContactEmail,
          monthlySpend: o.monthlySpend,
          totalMembers,
          activeMembers,
          activeRate,
          totalCoaches: o.coachAssignments.length,
          coaches: o.coachAssignments.map((a) => a.coach),
          createdAt: o.createdAt,
        };
      })
    );
  } catch (error) {
    console.error("[adminGetOrgs]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminCreateOrg = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      name, type, plan, primaryContactName, primaryContactEmail,
      primaryContactPassword, monthlySpend, domain, coachIds,
    } = req.body;

    if (!name || !primaryContactEmail || !primaryContactPassword) {
      return res.status(400).json({
        message: "name, primaryContactEmail and primaryContactPassword are required",
      });
    }

    const existing = await prisma.organization.findUnique({ where: { primaryContactEmail } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPw = await hashPassword(primaryContactPassword);

    const org = await prisma.organization.create({
      data: {
        name,
        type: type ?? "University",
        plan: plan ?? "Starter",
        primaryContactName: primaryContactName ?? "",
        primaryContactEmail,
        primaryContactPassword: hashedPw,
        monthlySpend: monthlySpend ? Number(monthlySpend) : 0,
        domain: domain ?? null,
        coachAssignments: Array.isArray(coachIds) && coachIds.length > 0
          ? { create: coachIds.map((coachId: string) => ({ coachId })) }
          : undefined,
      },
      include: {
        coachAssignments: {
          include: {
            coach: {
              select: { id: true, name: true, email: true, speciality: true, isActive: true },
            },
          },
        },
      },
    });

    return res.status(201).json({
      id: org.id,
      name: org.name,
      type: org.type,
      plan: org.plan,
      status: org.status,
      primaryContactName: org.primaryContactName,
      primaryContactEmail: org.primaryContactEmail,
      monthlySpend: org.monthlySpend,
      totalMembers: 0,
      activeMembers: 0,
      activeRate: 0,
      totalCoaches: org.coachAssignments.length,
      coaches: org.coachAssignments.map((a) => a.coach),
      createdAt: org.createdAt,
    });
  } catch (error) {
    console.error("[adminCreateOrg]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminUpdateOrg = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const { name, type, plan, primaryContactName, monthlySpend, status, domain, coachIds } = req.body;

    const org = await prisma.organization.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(plan !== undefined && { plan }),
        ...(primaryContactName !== undefined && { primaryContactName }),
        ...(monthlySpend !== undefined && { monthlySpend: Number(monthlySpend) }),
        ...(status !== undefined && { status }),
        ...(domain !== undefined && { domain }),
      },
    });

    if (Array.isArray(coachIds)) {
      await prisma.organizationCoach.deleteMany({ where: { organizationId: req.params.id } });
      if (coachIds.length > 0) {
        await prisma.organizationCoach.createMany({
          data: coachIds.map((coachId: string) => ({ organizationId: req.params.id, coachId })),
          skipDuplicates: true,
        });
      }
    }

    const assignments = await prisma.organizationCoach.findMany({
      where: { organizationId: req.params.id },
      include: {
        coach: {
          select: { id: true, name: true, email: true, speciality: true, isActive: true },
        },
      },
    });

    return res.status(200).json({
      id: org.id,
      name: org.name,
      type: org.type,
      plan: org.plan,
      status: org.status,
      primaryContactName: org.primaryContactName,
      primaryContactEmail: org.primaryContactEmail,
      monthlySpend: org.monthlySpend,
      totalCoaches: assignments.length,
      coaches: assignments.map((a) => a.coach),
      createdAt: org.createdAt,
    });
  } catch (error) {
    console.error("[adminUpdateOrg]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetOrgOverview = async (
  req: Request<IdParam>,
  res: Response
): Promise<Response> => {
  try {
    const orgId = req.params.id;
    if (!orgId) return res.status(400).json({ message: "Organization ID is required" });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) return res.status(404).json({ message: "Organization not found" });

    const [totalMembers, activeMembers, totalCoaches] = await Promise.all([
      prisma.user.count({ where: { organizationId: orgId } }),
      prisma.user.count({ where: { organizationId: orgId, isVerified: true } }),
      prisma.organizationCoach.count({ where: { organizationId: orgId } }),
    ]);

    const engagementRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;

    return res.status(200).json({
      orgName: organization.name,
      type: organization.type,
      plan: organization.plan,
      status: organization.status,
      totalMembers,
      activeMembers,
      totalCoaches,
      engagementRate: Number(engagementRate.toFixed(2)),
      sessionsThisMonth: 0,
      avgPhqScore: null,
    });
  } catch (error) {
    console.error("[adminGetOrgOverview]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── DASHBOARD AGGREGATES (superadmin home) ───────────────────────────────────

const ACTIVITY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const adminGetActivity = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const since = new Date(Date.now() - ACTIVITY_WINDOW_MS);

    const [newUsers, memberships, flaggedPosts, newOrgs, newCoaches] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: since }, role: { not: "superadmin" } },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.groupMembership.findMany({
        where: { joinedAt: { gte: since } },
        orderBy: { joinedAt: "desc" },
        take: 8,
        include: {
          member: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
      prisma.peerGroupPost.findMany({
        where: { createdAt: { gte: since }, isFlagged: true },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          member: { select: { name: true } },
          group: { select: { name: true } },
        },
      }),
      prisma.organization.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, createdAt: true },
      }),
      prisma.coach.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, createdAt: true },
      }),
    ]);

    type Out = {
      id: string;
      type: string;
      message: string;
      createdAt: string;
      actorName: string | null;
    };

    const rows: Array<Out & { _t: number }> = [];

    newUsers.forEach((u) =>
      rows.push({
        id: `user-${u.id}`,
        type: "admin",
        message: "joined the platform",
        createdAt: u.createdAt.toISOString(),
        actorName: u.name,
        _t: u.createdAt.getTime(),
      })
    );

    memberships.forEach((m) =>
      rows.push({
        id: `gm-${m.id}`,
        type: "join",
        message: `joined ${m.group.name}`,
        createdAt: m.joinedAt.toISOString(),
        actorName: m.member.name,
        _t: m.joinedAt.getTime(),
      })
    );

    flaggedPosts.forEach((p) =>
      rows.push({
        id: `post-${p.id}`,
        type: "alert",
        message: `flagged post in ${p.group.name}`,
        createdAt: p.createdAt.toISOString(),
        actorName: p.member.name,
        _t: p.createdAt.getTime(),
      })
    );

    newOrgs.forEach((o) =>
      rows.push({
        id: `org-${o.id}`,
        type: "org",
        message: "new partner organization added",
        createdAt: o.createdAt.toISOString(),
        actorName: o.name,
        _t: o.createdAt.getTime(),
      })
    );

    newCoaches.forEach((c) =>
      rows.push({
        id: `coach-${c.id}`,
        type: "admin",
        message: "new coach onboarded",
        createdAt: c.createdAt.toISOString(),
        actorName: c.name,
        _t: c.createdAt.getTime(),
      })
    );

    rows.sort((a, b) => b._t - a._t);
    const payload = rows.slice(0, 20).map(({ _t: _unused, ...rest }) => rest);

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[adminGetActivity]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetMoodDistribution = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const grouped = await prisma.mood.groupBy({
      by: ["mood"],
      _count: { _all: true },
    });

    const counts: Record<string, number> = {
      GREAT: 0, GOOD: 0, OKAY: 0, LOW: 0, HARD: 0,
    };

    for (const row of grouped) {
      const key = String(row.mood).toUpperCase();
      if (key in counts) counts[key] = row._count._all;
    }

    return res.status(200).json({
      great: counts.GREAT,
      good: counts.GOOD,
      okay: counts.OKAY,
      low: counts.LOW,
      struggling: counts.HARD,
    });
  } catch (error) {
    console.error("[adminGetMoodDistribution]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetOverviewStats = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const [totalUsers, activeCoaches, pendingUsers, totalSessions] = await Promise.all([
      prisma.user.count({ where: { role: { not: "superadmin" } } }),
      prisma.coach.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: { not: "superadmin" }, isVerified: false } }),
      prisma.session.count(),
    ]);

    return res.status(200).json({
      totalUsers,
      activeCoaches,
      pendingUsers,
      totalSessions,
    });
  } catch (error) {
    console.error("[adminGetOverviewStats]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetActivityChart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get users: use lastActiveAt if available, otherwise createdAt (for historical data)
    const users = await prisma.user.findMany({
      where: {
        role: "member",
        OR: [
          { lastActiveAt: { gte: startDate } },
          { 
            lastActiveAt: null,
            createdAt: { gte: startDate }
          }
        ]
      },
      select: { id: true, lastActiveAt: true, createdAt: true },
    });

    // Get coaches: use lastActiveAt if available, otherwise createdAt
    const coaches = await prisma.coach.findMany({
      where: {
        OR: [
          { lastActiveAt: { gte: startDate } },
          { 
            lastActiveAt: null,
            createdAt: { gte: startDate }
          }
        ]
      },
      select: { id: true, lastActiveAt: true, createdAt: true },
    });

    // Get organizations: use lastActiveAt if available, otherwise createdAt
    const orgs = await prisma.organization.findMany({
      where: {
        OR: [
          { lastActiveAt: { gte: startDate } },
          { 
            lastActiveAt: null,
            createdAt: { gte: startDate }
          }
        ]
      },
      select: { id: true, lastActiveAt: true, createdAt: true },
    });

    console.log(`[adminGetActivityChart] Found ${users.length} users, ${coaches.length} coaches, ${orgs.length} orgs with activity in last ${days} days`);

    // Group by date - count unique users/coaches/orgs per day
    const dateMap = new Map<string, { users: Set<string>; coaches: Set<string>; orgs: Set<string> }>();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const key = date.toISOString().split('T')[0];
      dateMap.set(key, { users: new Set(), coaches: new Set(), orgs: new Set() });
    }

    // Track unique users per day (use lastActiveAt if available, fallback to createdAt)
    users.forEach((u) => {
      const activeDate = u.lastActiveAt || u.createdAt;
      if (activeDate) {
        const key = new Date(activeDate).toISOString().split('T')[0];
        const entry = dateMap.get(key);
        if (entry) entry.users.add(u.id);
      }
    });

    coaches.forEach((c) => {
      const activeDate = c.lastActiveAt || c.createdAt;
      if (activeDate) {
        const key = new Date(activeDate).toISOString().split('T')[0];
        const entry = dateMap.get(key);
        if (entry) entry.coaches.add(c.id);
      }
    });

    orgs.forEach((o) => {
      const activeDate = o.lastActiveAt || o.createdAt;
      if (activeDate) {
        const key = new Date(activeDate).toISOString().split('T')[0];
        const entry = dateMap.get(key);
        if (entry) entry.orgs.add(o.id);
      }
    });

    const chartData = Array.from(dateMap.entries()).map(([date, sets]) => ({
      date,
      users: sets.users.size,
      coaches: sets.coaches.size,
      orgs: sets.orgs.size,
    }));

    console.log(`[adminGetActivityChart] Returning ${chartData.length} data points`);

    return res.status(200).json(chartData);
  } catch (error) {
    console.error("[adminGetActivityChart]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const adminGetScoresHistory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const orgId = process.env.PYTHON_ORG_ID ?? "org_default";
    const pythonUrl = `${process.env.PYTHON_BACKEND_URL}/v1/admin/events/${orgId}?limit=100`;

    const response = await fetch(pythonUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch from Python backend: ${response.statusText}`);
    }
    const rawEvents: any = await response.json();

    let tokens = Array.from(new Set(rawEvents.map((e: any) => e.member_token))) as string[];

    // If role is coach, only find users assigned to this coach
    if (req.user && req.user.role === "coach") {
      const coachMembers = await prisma.coachMember.findMany({
        where: { coachId: req.user.id },
        select: { userId: true },
      });
      const assignedUserIds = new Set(coachMembers.map((cm) => cm.userId));
      tokens = tokens.filter((t) => assignedUserIds.has(t));
    }

    const users = await prisma.user.findMany({
      where: { id: { in: tokens } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    const history = rawEvents
      .filter((e: any) => nameMap.has(e.member_token))
      .map((e: any) => ({
        member_token: e.member_token,
        client_name: nameMap.get(e.member_token) ?? "Member",
        risk_tier: e.risk_tier,
        risk_score: e.risk_score,
        risk_trend: e.risk_trend ?? "stable",
        recommended_action: e.recommended_action ?? "no_action",
        active_signals: e.active_signals ?? [],
        processed_at: e.event_timestamp,
      }));

    return res.status(200).json(history);
  } catch (error) {
    console.error("[adminGetScoresHistory]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};