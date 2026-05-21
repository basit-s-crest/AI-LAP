"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initRealtime = initRealtime;
exports.notifyMembers = notifyMembers;
exports.notifyCoach = notifyCoach;
let io = null;
function initRealtime(server) {
    io = server;
}
/** Notify member users on the coach-chat namespace (personal `user:{id}` rooms). */
function notifyMembers(memberIds, event, payload) {
    if (!io || memberIds.length === 0)
        return;
    const ns = io.of("/coach-chat");
    for (const memberId of memberIds) {
        ns.to(`user:${memberId}`).emit(event, payload);
    }
}
/** Notify a coach on their personal room. */
function notifyCoach(coachId, event, payload) {
    if (!io)
        return;
    io.of("/coach-chat").to(`coach:${coachId}`).emit(event, payload);
}
