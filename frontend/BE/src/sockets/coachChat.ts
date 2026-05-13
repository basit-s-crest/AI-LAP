import { Server, Socket } from "socket.io";
import prisma from "../lib/prisma";
import {
  saveMessage,
  markRead,
  toCoachMessageDTO,
  ValidationError,
  AssignmentError,
} from "../services/coachMessage.service";
import { forwardToSentiment } from "../services/sentimentForwarder";

export function registerCoachChatHandlers(io: Server, socket: Socket): void {
  const user = socket.data.user as { id: string; role: "member" | "coach" };

  // Join personal room on connection
  const personalRoom = user.role === "member" ? `user:${user.id}` : `coach:${user.id}`;
  socket.join(personalRoom);

  // 4.5 — join_thread (idempotent — already in personal room)
  socket.on("join_thread", (_data: { partnerId: string }) => {
    socket.join(personalRoom);
  });

  // 4.6 — send_message
  socket.on(
    "send_message",
    async (data: { partnerId: string; content: string }) => {
      try {
        const userId = user.role === "member" ? user.id : data.partnerId;
        const coachId = user.role === "coach" ? user.id : data.partnerId;

        // Assignment guard — also enforced inside saveMessage, but check here for early error emit
        const assignment = await prisma.coachMember.findUnique({
          where: { coachId_userId: { coachId, userId } },
        });

        if (!assignment) {
          socket.emit("error", {
            code: "UNAUTHORIZED_THREAD",
            message: "No assignment found",
          });
          return;
        }

        const message = await saveMessage({
          userId,
          coachId,
          content: data.content,
          senderRole: user.role,
        });

        const dto = toCoachMessageDTO(message);

        // Acknowledge sender
        socket.emit("message_saved", dto);

        // Deliver to partner's personal room
        const partnerRoom =
          user.role === "member" ? `coach:${coachId}` : `user:${userId}`;
        io.of("/coach-chat").to(partnerRoom).emit("new_message", dto);

        // Sentiment — member messages only
        if (user.role === "member") {
          forwardToSentiment(message);
        }
      } catch (err) {
        if (err instanceof ValidationError || err instanceof AssignmentError) {
          socket.emit("error", {
            code: err instanceof AssignmentError ? "UNAUTHORIZED_THREAD" : "VALIDATION_ERROR",
            message: err.message,
          });
        } else {
          socket.emit("error", {
            code: "SAVE_FAILED",
            message: "Message could not be saved",
          });
        }
      }
    }
  );

  // 4.7 — mark_read
  socket.on("mark_read", async (data: { partnerId: string }) => {
    try {
      await markRead(user.id, user.role, data.partnerId);

      const partnerRoom =
        user.role === "member"
          ? `coach:${data.partnerId}`
          : `user:${data.partnerId}`;

      io.of("/coach-chat").to(partnerRoom).emit("read_receipt", {
        partnerId: user.id,
        readAt: new Date().toISOString(),
      });
    } catch {
      // Silently ignore mark_read errors
    }
  });
}
