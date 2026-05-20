import type { Server } from "socket.io";

let io: Server | null = null;

export function initRealtime(server: Server): void {
  io = server;
}

/** Notify member users on the coach-chat namespace (personal `user:{id}` rooms). */
export function notifyMembers(
  memberIds: string[],
  event: string,
  payload: Record<string, unknown>
): void {
  if (!io || memberIds.length === 0) return;
  const ns = io.of("/coach-chat");
  for (const memberId of memberIds) {
    ns.to(`user:${memberId}`).emit(event, payload);
  }
}

/** Notify a coach on their personal room. */
export function notifyCoach(
  coachId: string,
  event: string,
  payload: Record<string, unknown>
): void {
  if (!io) return;
  io.of("/coach-chat").to(`coach:${coachId}`).emit(event, payload);
}
