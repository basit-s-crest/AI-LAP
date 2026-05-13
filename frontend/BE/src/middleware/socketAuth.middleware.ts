import { Socket } from "socket.io";
import jwt from "jsonwebtoken";

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): void {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error("Unauthorized"));
    }

    const decoded = jwt.verify(token, secret) as { id?: string; role?: string };

    if (!decoded.id || !decoded.role) {
      return next(new Error("Unauthorized"));
    }

    socket.data.user = {
      id: decoded.id,
      role: decoded.role as "member" | "coach",
    };

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
}
