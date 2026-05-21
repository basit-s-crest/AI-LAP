import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { comparePassword, generateToken, hashPassword } from "../services/auth.service";
import { buildOrgOutcomesMetrics, buildOrgOverviewMetrics } from "../services/orgStats.service";

export const orgRegister = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, firstName, lastName, organizationName, organizationType } = req.body;
    if (!email || !password || !firstName || !organizationName) {
      return res.status(400).json({
        message: "Organization name, contact first name, email, and password are required",
      });
    }

    const existing = await prisma.organization.findUnique({
      where: { primaryContactEmail: email },
    });
    if (existing) {
      return res.status(409).json({ message: "Organization contact email already registered" });
    }

    const primaryContactPassword = await hashPassword(password);
    const primaryContactName = [firstName, lastName].filter(Boolean).join(" ").trim();

    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        type: organizationType || "University",
        primaryContactName: primaryContactName || firstName,
        primaryContactEmail: email,
        primaryContactPassword,
      },
      select: {
        id: true,
        name: true,
        type: true,
        plan: true,
        status: true,
      },
    });

    return res.status(201).json({
      message: "Organization account created",
      organization,
    });
  } catch (error) {
    console.error("[orgRegister]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const orgLogin = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;
    const platform = await prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: { maintenanceMode: true },
    });
    if (platform?.maintenanceMode) {
      return res.status(503).json({ message: "Site is under maintenance" });
    }

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const organization = await prisma.organization.findUnique({
      where: { primaryContactEmail: email },
    });
    if (!organization) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await comparePassword(password, organization.primaryContactPassword);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(organization.id, "organization", organization.id);
    return res.status(200).json({
      token,
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        plan: organization.plan,
        status: organization.status,
      },
    });
  } catch (error) {
    console.error("[orgLogin]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrgOverview = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) return res.status(404).json({ message: "Organization not found" });

    const [metrics, totalCoaches] = await Promise.all([
      buildOrgOverviewMetrics(orgId),
      prisma.organizationCoach.count({ where: { organizationId: orgId } }),
    ]);

    return res.status(200).json({
      orgName: organization.name,
      type: organization.type,
      plan: organization.plan,
      status: organization.status,
      totalCoaches,
      ...metrics,
    });
  } catch (error) {
    console.error("[getOrgOverview]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrgMembers = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const members = await prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isVerified: true,
        createdAt: true,
        avatar: true,
        role: true,
      },
    });

    return res.status(200).json(
      members.map((member) => ({
        ...member,
        status: member.isVerified ? "active" : "pending",
      }))
    );
  } catch (error) {
    console.error("[getOrgMembers]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrgCoaches = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const assignments = await prisma.organizationCoach.findMany({
      where: { organizationId: orgId },
      orderBy: { assignedAt: "desc" },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
            speciality: true,
            bio: true,
            isActive: true,
            avatar: true,
            createdAt: true,
          },
        },
      },
    });

    const coaches = assignments.map(a => a.coach);
    return res.status(200).json(coaches);
  } catch (error) {
    console.error("[getOrgCoaches]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrgOutcomes = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) return res.status(404).json({ message: "Organization not found" });

    const outcomes = await buildOrgOutcomesMetrics(orgId);
    return res.status(200).json(outcomes);
  } catch (error) {
    console.error("[getOrgOutcomes]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getOrgSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        type: true,
        plan: true,
        primaryContactName: true,
        primaryContactEmail: true,
        status: true,
        notifyWeeklyReport: true,
        notifyCrisisAlerts: true,
        notifyNewMembers: true,
      },
    });

    if (!organization) return res.status(404).json({ message: "Organization not found" });
    return res.status(200).json(organization);
  } catch (error) {
    console.error("[getOrgSettings]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateOrgSettings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ message: "Unauthorized" });

    const { name, type, notifyWeeklyReport, notifyCrisisAlerts, notifyNewMembers } = req.body;
    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(notifyWeeklyReport !== undefined ? { notifyWeeklyReport: Boolean(notifyWeeklyReport) } : {}),
        ...(notifyCrisisAlerts !== undefined ? { notifyCrisisAlerts: Boolean(notifyCrisisAlerts) } : {}),
        ...(notifyNewMembers !== undefined ? { notifyNewMembers: Boolean(notifyNewMembers) } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        plan: true,
        primaryContactName: true,
        primaryContactEmail: true,
        status: true,
        notifyWeeklyReport: true,
        notifyCrisisAlerts: true,
        notifyNewMembers: true,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("[updateOrgSettings]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
