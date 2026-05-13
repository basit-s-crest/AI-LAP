import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type UserRole = "member" | "coach" | "organization" | "superadmin";

export interface TokenPayload {
  id: string;
  role: UserRole;
  orgId?: string;
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

/**
 * Generate JWT token
 */
export const generateToken = (
  id: string,
  role: UserRole,
  orgId?: string
): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id,
      role,
      ...(orgId ? { orgId } : {}),
    },
    secret,
    {
      expiresIn: "7d",
    }
  );
};

// ─── PASSWORD ─────────────────────────────────────────────────────────────────

/**
 * Hash password before storing in DB
 */
export const hashPassword = async (
  password: string
): Promise<string> => {
  return bcrypt.hash(password, 10);
};

/**
 * Compare plain password with hashed password
 */
export const comparePassword = async (
  plain: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hashed);
};

// ─── OTP ──────────────────────────────────────────────────────────────────────

/**
 * Hash OTP before storing
 */
export const hashOtp = async (
  otp: string
): Promise<string> => {
  return bcrypt.hash(otp, 8);
};

/**
 * Compare OTP
 */
export const compareOtp = async (
  plain: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hashed);
};