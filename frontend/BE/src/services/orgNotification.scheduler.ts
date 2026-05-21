import prisma from "../lib/prisma";
import {
  emailOrgDailyNewMemberDigest,
  emailOrgWeeklyOutcomeReport,
} from "./notificationEmail.service";

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

let lastWeeklyKey = "";
let lastDailyKey = "";

function dateKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function weekKey(d = new Date()): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return dateKey(start);
}

async function runWeeklyReports(): Promise<void> {
  const now = new Date();
  if (now.getDay() !== 1) return;
  const key = weekKey(now);
  if (lastWeeklyKey === key) return;
  lastWeeklyKey = key;

  const orgs = await prisma.organization.findMany({
    where: { notifyWeeklyReport: true, status: "active" },
    select: { id: true },
  });

  for (const org of orgs) {
    try {
      await emailOrgWeeklyOutcomeReport(org.id);
    } catch (err) {
      console.error("[orgNotification] weekly report failed", org.id, err);
    }
  }
}

async function runDailyDigests(): Promise<void> {
  const key = dateKey();
  if (lastDailyKey === key) return;
  lastDailyKey = key;

  const orgs = await prisma.organization.findMany({
    where: { notifyNewMembers: true, status: "active" },
    select: { id: true },
  });

  for (const org of orgs) {
    try {
      await emailOrgDailyNewMemberDigest(org.id);
    } catch (err) {
      console.error("[orgNotification] daily digest failed", org.id, err);
    }
  }
}

/** Poll every hour; send Monday weekly reports and once-daily member digests. */
export function startOrgNotificationScheduler(): void {
  const tick = () => {
    void runWeeklyReports();
    void runDailyDigests();
  };

  tick();
  setInterval(tick, MS_HOUR);
  console.log("[orgNotification] scheduler started (hourly check)");
}
