import { Request, Response } from "express";

import prisma from "../lib/prisma";
import {
  compareOtp,
  comparePassword,
  generateToken,
  hashOtp,
  hashPassword,
} from "../services/auth.service";
import { generateOtp, sendVerificationEmail } from "../services/email.service";

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
    const { email, name, password, avatar } = req.body;

    if (!email || !name || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
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
        role: "member",
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

    const token = generateToken(user.id, "member");

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

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Email not verified. Please verify your account first.",
        userId: user.id,
      });
    }

    const token = generateToken(user.id, "member");

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
