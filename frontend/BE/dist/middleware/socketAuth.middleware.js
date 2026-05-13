"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = socketAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function socketAuthMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error("Unauthorized"));
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return next(new Error("Unauthorized"));
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        if (!decoded.id || !decoded.role) {
            return next(new Error("Unauthorized"));
        }
        socket.data.user = {
            id: decoded.id,
            role: decoded.role,
        };
        next();
    }
    catch {
        next(new Error("Unauthorized"));
    }
}
