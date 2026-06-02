import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  role: "member" | "coach" | "organization" | "superadmin";
  orgId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Validates the Bearer JWT from the Authorization header.
 * Attaches { id, role } to req.user on success.
 * Updates lastActiveAt for member users.
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({ message: "JWT secret not configured" });
    }

    const decoded = jwt.verify(token, secret) as { id?: string; role?: string; orgId?: string };

    if (!decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    req.user = {
      id: decoded.id,
      role: decoded.role as "member" | "coach" | "organization" | "superadmin",
      orgId: decoded.orgId,
    };

    // Update lastActiveAt for all user types (async, don't wait)
    if (decoded.role === "member") {
      void prisma.user.update({
        where: { id: decoded.id },
        data: { lastActiveAt: new Date() },
      }).catch(() => {
        // Silently fail - don't block the request
      });
    } else if (decoded.role === "coach") {
      void prisma.coach.update({
        where: { id: decoded.id },
        data: { lastActiveAt: new Date() },
      }).catch(() => {
        // Silently fail - don't block the request
      });
    } else if (decoded.role === "organization") {
      void prisma.organization.update({
        where: { id: decoded.id },
        data: { lastActiveAt: new Date() },
      }).catch(() => {
        // Silently fail - don't block the request
      });
    }

    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/**
 * Role guard — use after authMiddleware.
 * Example: router.get("/admin", authMiddleware, requireRole("coach"), handler)
 */
export const requireRole = (...roles: Array<"member" | "coach" | "organization" | "superadmin">) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    return next();
  };
};
