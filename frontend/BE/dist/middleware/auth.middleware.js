"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
// ─── Middleware ───────────────────────────────────────────────────────────────
/**
 * Validates the Bearer JWT from the Authorization header.
 * Attaches { id, role } to req.user on success.
 * Updates lastActiveAt for member users.
 */
const authMiddleware = (req, res, next) => {
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
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (!decoded.id || !decoded.role) {
            return res.status(401).json({ message: "Invalid token payload" });
        }
        req.user = {
            id: decoded.id,
            role: decoded.role,
            orgId: decoded.orgId,
        };
        // Update lastActiveAt for all user types (async, don't wait)
        if (decoded.role === "member") {
            void prisma_1.default.user.update({
                where: { id: decoded.id },
                data: { lastActiveAt: new Date() },
            }).catch(() => {
                // Silently fail - don't block the request
            });
        }
        else if (decoded.role === "coach") {
            void prisma_1.default.coach.update({
                where: { id: decoded.id },
                data: { lastActiveAt: new Date() },
            }).catch(() => {
                // Silently fail - don't block the request
            });
        }
        else if (decoded.role === "organization") {
            void prisma_1.default.organization.update({
                where: { id: decoded.id },
                data: { lastActiveAt: new Date() },
            }).catch(() => {
                // Silently fail - don't block the request
            });
        }
        return next();
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.authMiddleware = authMiddleware;
/**
 * Role guard — use after authMiddleware.
 * Example: router.get("/admin", authMiddleware, requireRole("coach"), handler)
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden: insufficient role" });
        }
        return next();
    };
};
exports.requireRole = requireRole;
