"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSessionAutoCompleter = startSessionAutoCompleter;
const prisma_1 = __importDefault(require("../lib/prisma"));
const MS_MINUTE = 60 * 1000;
const CHECK_INTERVAL = 15 * MS_MINUTE;
async function checkAndCompleteSessions() {
    const now = new Date();
    try {
        const sessions = await prisma_1.default.session.findMany({
            where: {
                status: { in: ["upcoming", "rescheduled"] },
                scheduledAt: { lt: now },
            },
        });
        const toComplete = sessions.filter((s) => s.scheduledAt.getTime() + s.duration * 60 * 1000 < now.getTime());
        for (const session of toComplete) {
            await prisma_1.default.session.update({
                where: { id: session.id },
                data: { status: "completed" },
            });
            console.log(`[sessionAutoCompleter] Session ${session.id} marked as completed.`);
        }
    }
    catch (err) {
        console.error("[sessionAutoCompleter] Error during auto-completion:", err);
    }
}
function startSessionAutoCompleter() {
    const tick = () => {
        void checkAndCompleteSessions();
    };
    tick();
    setInterval(tick, CHECK_INTERVAL);
    console.log("[sessionAutoCompleter] scheduler started (15-minute check)");
}
