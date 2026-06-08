import prisma from "../lib/prisma";

const MS_MINUTE = 60 * 1000;
const CHECK_INTERVAL = 15 * MS_MINUTE;

async function checkAndCompleteSessions(): Promise<void> {
  const now = new Date();
  try {
    const sessions = await prisma.session.findMany({
      where: {
        status: { in: ["upcoming", "rescheduled"] },
        scheduledAt: { lt: now },
      },
    });

    const toComplete = sessions.filter(
      (s) => s.scheduledAt.getTime() + s.duration * 60 * 1000 < now.getTime()
    );

    for (const session of toComplete) {
      await prisma.session.update({
        where: { id: session.id },
        data: { status: "completed" },
      });
      console.log(`[sessionAutoCompleter] Session ${session.id} marked as completed.`);
    }
  } catch (err) {
    console.error("[sessionAutoCompleter] Error during auto-completion:", err);
  }
}

export function startSessionAutoCompleter(): void {
  const tick = () => {
    void checkAndCompleteSessions();
  };

  tick();
  setInterval(tick, CHECK_INTERVAL);
  console.log("[sessionAutoCompleter] scheduler started (15-minute check)");
}
