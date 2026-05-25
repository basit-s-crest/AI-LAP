"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOrgNotificationScheduler = startOrgNotificationScheduler;
const prisma_1 = __importDefault(require("../lib/prisma"));
const notificationEmail_service_1 = require("./notificationEmail.service");
const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;
let lastWeeklyKey = "";
let lastDailyKey = "";
function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function weekKey(d = new Date()) {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    return dateKey(start);
}
async function runWeeklyReports() {
    const now = new Date();
    if (now.getDay() !== 1)
        return;
    const key = weekKey(now);
    if (lastWeeklyKey === key)
        return;
    lastWeeklyKey = key;
    const orgs = await prisma_1.default.organization.findMany({
        where: { notifyWeeklyReport: true, status: "active" },
        select: { id: true },
    });
    for (const org of orgs) {
        try {
            await (0, notificationEmail_service_1.emailOrgWeeklyOutcomeReport)(org.id);
        }
        catch (err) {
            console.error("[orgNotification] weekly report failed", org.id, err);
        }
    }
}
async function runDailyDigests() {
    const key = dateKey();
    if (lastDailyKey === key)
        return;
    lastDailyKey = key;
    const orgs = await prisma_1.default.organization.findMany({
        where: { notifyNewMembers: true, status: "active" },
        select: { id: true },
    });
    for (const org of orgs) {
        try {
            await (0, notificationEmail_service_1.emailOrgDailyNewMemberDigest)(org.id);
        }
        catch (err) {
            console.error("[orgNotification] daily digest failed", org.id, err);
        }
    }
}
/** Poll every hour; send Monday weekly reports and once-daily member digests. */
function startOrgNotificationScheduler() {
    const tick = () => {
        void runWeeklyReports();
        void runDailyDigests();
    };
    tick();
    setInterval(tick, MS_HOUR);
    console.log("[orgNotification] scheduler started (hourly check)");
}
