import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ─── JWT ──────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  id: string;
  role: "member" | "coach";
}

/**
 * Signs a JWT with the given id and role.
 * Expires in 7 days.
 */
export const generateToken = (id: string, role: "member" | "coach"): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");

  return jwt.sign({ id, role }, secret, { expiresIn: "7d" });
};

// ─── Password ─────────────────────────────────────────────────────────────────

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const comparePassword = async (
  plain: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hashed);
};

// ─── OTP ──────────────────────────────────────────────────────────────────────

/**
 * Hashes a plain OTP before storing it in the database.
 * Uses bcrypt with a low cost factor (8) since OTPs are short-lived.
 */
export const hashOtp = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, 8);
};

export const compareOtp = async (
  plain: string,
  hashed: string
): Promise<boolean> => {
  return bcrypt.compare(plain, hashed);
};
