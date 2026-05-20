import { Request, Response } from "express";

import prisma from "../lib/prisma";
import {
  getActiveCoachesForMemberOrganization,
} from "../services/member-org-coach.service";
import {
  compareOtp,
  comparePassword,
  generateToken,
  hashOtp,
  hashPassword,
  type UserRole,
} from "../services/auth.service";
import { generateOtp, sendVerificationEmail } from "../services/email.service";
import {
  getMemberAssessments,
  getMemberStats,
} from "../services/memberProfile.service";

async function getPlatformFlags(): Promise<{
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
}> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
    select: { allowSelfRegistration: true, maintenanceMode: true },
  });
  return {
    allowSelfRegistration: settings?.allowSelfRegistration ?? true,
    maintenanceMode: settings?.maintenanceMode ?? false,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sanitizeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatar: user.avatar,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─── Register ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Creates an unverified member account and sends a 6-digit OTP to their email.
 */
export const register = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { email, name, password, avatar, role: rawRole, adminCode } = req.body;

    if (!email || !name || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    // Only allow known roles; default to "member" for safety
    const ALLOWED_ROLES = ["member", "superadmin"] as const;
    type AllowedRole = typeof ALLOWED_ROLES[number];
    const role: AllowedRole = ALLOWED_ROLES.includes(rawRole) ? rawRole : "member";

    const platform = await getPlatformFlags();
    if (role === "member" && !platform.allowSelfRegistration) {
      return res.status(403).json({ message: "Self registration is currently disabled." });
    }

    // Superadmin registration requires a valid invite code
    if (role === "superadmin") {
      const expectedCode = process.env.SUPERADMIN_INVITE_CODE;
      if (!expectedCode || adminCode !== expectedCode) {
        // console.log(adminCode)
        return res.status(403).json({ message: "Invalid admin invite code" });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashedPassword = await hashPassword(password);

    // Create the user — not verified yet
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role,
        avatar: avatar ?? null,
        isVerified: false,
      },
    });

    // Generate OTP, hash it, store with 15-min expiry
    const otp = generateOtp();
    const hashedOtp = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        otp: hashedOtp,
        expiresAt,
      },
    });

    // Send the plain OTP via email
    await sendVerificationEmail(user.email, user.name, otp);

    return res.status(201).json({
      message: "Account created. Check your email for the verification code.",
      userId: user.id,
    });
  } catch (error) {
    console.error("[register]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Verify OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/verify-otp
 * Body: { userId, otp }
 * Marks the user as verified and returns a JWT.
 */
export const verifyOtp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "userId and otp are required" });
    }

    // Find the most recent unused, non-expired OTP for this user
    const record = await prisma.emailVerification.findFirst({
      where: {
        userId,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      return res
        .status(400)
        .json({ message: "OTP expired or not found. Request a new one." });
    }

    const isValid = await compareOtp(otp, record.otp);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark OTP as used and verify the user in one transaction
    await prisma.$transaction([
      prisma.emailVerification.update({
        where: { id: record.id },
        data: { used: true },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { isVerified: true },
      }),
    ]);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = generateToken(user.id, user.role as UserRole);

    return res.status(200).json({
      message: "Email verified successfully",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("[verifyOtp]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Resend OTP ───────────────────────────────────────────────────────────────

/**
 * POST /api/auth/resend-otp
 * Body: { userId }
 * Invalidates old OTPs and sends a fresh one.
 */
export const resendOtp = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Account is already verified" });
    }

    // Invalidate all previous OTPs for this user
    await prisma.emailVerification.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    const otp = generateOtp();
    const hashedOtp = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.emailVerification.create({
      data: { userId, otp: hashedOtp, expiresAt },
    });

    await sendVerificationEmail(user.email, user.name, otp);

    return res.status(200).json({ message: "New verification code sent" });
  } catch (error) {
    console.error("[resendOtp]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns a JWT only if the account is verified.
 */
export const login = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Generic message to avoid user enumeration
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const platform = await getPlatformFlags();
    if (platform.maintenanceMode && user.role !== "superadmin") {
      return res.status(503).json({ message: "Site is under maintenance" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your account first.",
        userId: user.id,
      });
    }

    const token = generateToken(user.id, user.role as UserRole);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("[login]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Forgot Password (stub) ───────────────────────────────────────────────────

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // TODO: implement password reset flow
  return res.status(200).json({ message: "If that email exists, a reset link has been sent." });
};

// ─── Get Coaches ──────────────────────────────────────────────────────────────

/**
 * GET /api/auth/coaches
 * Members: coaches in their org via OrganizationCoach only (id + name). No org → [].
 * Other roles: all coaches (minimal fields) for admin/staff flows.
 */
export const getCoaches = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    if (req.user?.role === "member" && req.user.id) {
      const coaches = await getActiveCoachesForMemberOrganization(req.user.id);
      return res.status(200).json(
        coaches.map((c) => ({ id: c.id, name: c.name }))
      );
    }

    const coaches = await prisma.coach.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return res.status(200).json(coaches);
  } catch (error) {
    console.error("[getCoaches]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Member profile & settings ────────────────────────────────────────────────

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function formatMemberSince(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** GET /api/auth/profile — member profile, stats, notifications, assessments. */
export const getMemberProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== "member") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const { firstName, lastName } = splitName(user.name);
    const [stats, assessments] = await Promise.all([
      getMemberStats(userId),
      getMemberAssessments(userId),
    ]);

    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName,
      lastName,
      avatar: user.avatar,
      memberSince: formatMemberSince(user.createdAt),
      stats,
      notifications: {
        notifyGroupActivity: user.notifyGroupActivity,
        notifySessionReminders: user.notifySessionReminders,
        notifyDailyCheckin: user.notifyDailyCheckin,
        notifyWeeklySummary: user.notifyWeeklySummary,
      },
      assessments,
    });
  } catch (error) {
    console.error("[getMemberProfile]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** PATCH /api/auth/profile — member name, avatar, password. */
export const updateMemberProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== "member") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { firstName, lastName, avatar, newPassword, confirmPassword } = req.body as {
      firstName?: string;
      lastName?: string;
      avatar?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    if (newPassword !== undefined) {
      if (!newPassword || newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
    }

    const data: {
      name?: string;
      avatar?: string;
      password?: string;
    } = {};

    if (firstName !== undefined || lastName !== undefined) {
      const existing = await prisma.user.findUnique({ where: { id: userId } });
      const current = splitName(existing?.name ?? "");
      data.name = `${firstName ?? current.firstName} ${lastName ?? current.lastName}`.trim();
    }
    if (avatar !== undefined) data.avatar = avatar;
    if (newPassword) data.password = await hashPassword(newPassword);

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    });

    const { firstName: fn, lastName: ln } = splitName(user.name);
    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: fn,
      lastName: ln,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("[updateMemberProfile]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

/** PATCH /api/auth/notifications — member notification preferences. */
export const updateMemberNotifications = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const userId = req.user?.id;
    if (!userId || req.user?.role !== "member") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const {
      notifyGroupActivity,
      notifySessionReminders,
      notifyDailyCheckin,
      notifyWeeklySummary,
    } = req.body as Record<string, boolean>;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(notifyGroupActivity !== undefined
          ? { notifyGroupActivity: Boolean(notifyGroupActivity) }
          : {}),
        ...(notifySessionReminders !== undefined
          ? { notifySessionReminders: Boolean(notifySessionReminders) }
          : {}),
        ...(notifyDailyCheckin !== undefined
          ? { notifyDailyCheckin: Boolean(notifyDailyCheckin) }
          : {}),
        ...(notifyWeeklySummary !== undefined
          ? { notifyWeeklySummary: Boolean(notifyWeeklySummary) }
          : {}),
      },
    });

    return res.status(200).json({
      notifyGroupActivity: user.notifyGroupActivity,
      notifySessionReminders: user.notifySessionReminders,
      notifyDailyCheckin: user.notifyDailyCheckin,
      notifyWeeklySummary: user.notifyWeeklySummary,
    });
  } catch (error) {
    console.error("[updateMemberNotifications]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
