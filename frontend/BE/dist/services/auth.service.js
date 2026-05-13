"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareOtp = exports.hashOtp = exports.comparePassword = exports.hashPassword = exports.generateToken = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// ─── JWT ──────────────────────────────────────────────────────────────────────
/**
 * Generate JWT token
 */
const generateToken = (id, role, orgId) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    return jsonwebtoken_1.default.sign({
        id,
        role,
        ...(orgId ? { orgId } : {}),
    }, secret, {
        expiresIn: "7d",
    });
};
exports.generateToken = generateToken;
// ─── PASSWORD ─────────────────────────────────────────────────────────────────
/**
 * Hash password before storing in DB
 */
const hashPassword = async (password) => {
    return bcryptjs_1.default.hash(password, 10);
};
exports.hashPassword = hashPassword;
/**
 * Compare plain password with hashed password
 */
const comparePassword = async (plain, hashed) => {
    return bcryptjs_1.default.compare(plain, hashed);
};
exports.comparePassword = comparePassword;
// ─── OTP ──────────────────────────────────────────────────────────────────────
/**
 * Hash OTP before storing
 */
const hashOtp = async (otp) => {
    return bcryptjs_1.default.hash(otp, 8);
};
exports.hashOtp = hashOtp;
/**
 * Compare OTP
 */
const compareOtp = async (plain, hashed) => {
    return bcryptjs_1.default.compare(plain, hashed);
};
exports.compareOtp = compareOtp;
