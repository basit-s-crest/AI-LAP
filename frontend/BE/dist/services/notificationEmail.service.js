"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeEmailCoachUnreadMessages = maybeEmailCoachUnreadMessages;
exports.emailCoachSessionUpdate = emailCoachSessionUpdate;
exports.emailMemberSessionUpdate = emailMemberSessionUpdate;
exports.emailOrgMembersCoachOnDemand = emailOrgMembersCoachOnDemand;
exports.emailCoachNewClientAssigned = emailCoachNewClientAssigned;
exports.emailOrgCrisisAlert = emailOrgCrisisAlert;
exports.emailOrgCoachesNewMember = emailOrgCoachesNewMember;
exports.emailOrgNewMemberJoined = emailOrgNewMemberJoined;
exports.notifyOrganizationMemberJoined = notifyOrganizationMemberJoined;
exports.emailOrgWeeklyOutcomeReport = emailOrgWeeklyOutcomeReport;
exports.emailOrgDailyNewMemberDigest = emailOrgDailyNewMemberDigest;
const prisma_1 = __importDefault(require("../lib/prisma"));
const emailTemplates_1 = require("./emailTemplates");
const email_service_1 = require("./email.service");
const MESSAGE_ALERT_THROTTLE_MS = 60 * 60 * 1000;
const messageAlertSentAt = new Map();
function throttleKey(coachId, memberId) {
    return `${coachId}:${memberId}`;
}
function canSendMessageAlert(coachId, memberId) {
    const key = throttleKey(coachId, memberId);
    const last = messageAlertSentAt.get(key) ?? 0;
    if (Date.now() - last < MESSAGE_ALERT_THROTTLE_MS)
        return false;
    messageAlertSentAt.set(key, Date.now());
    return true;
}
/**
 * When a member has more than 2 unread messages, email the coach (if enabled).
 * Throttled to once per hour per member thread.
 */
async function maybeEmailCoachUnreadMessages(coachId, memberId) {
    const [coach, member, unreadCount] = await Promise.all([
        prisma_1.default.coach.findUnique({
            where: { id: coachId },
            select: { email: true, name: true, notifyMessageAlerts: true },
        }),
        prisma_1.default.user.findUnique({
            where: { id: memberId },
            select: { name: true },
        }),
        prisma_1.default.coachMessage.count({
            where: {
                coachId,
                userId: memberId,
                senderRole: "member",
                read: false,
            },
        }),
    ]);
    if (!coach?.email || !coach.notifyMessageAlerts)
        return;
    if (unreadCount <= 2)
        return;
    if (!canSendMessageAlert(coachId, memberId))
        return;
    const memberName = member?.name ?? "A member";
    (0, email_service_1.sendAppEmailSafe)(coach.email, `New messages from ${memberName}`, {
        title: "You have unread messages",
        greeting: `Hi ${coach.name},`,
        lines: [
            `${memberName} has ${unreadCount} unread messages waiting for you in the portal.`,
            "Open your inbox to reply when you have a moment.",
        ],
        ctaLabel: "View messages",
        ctaUrl: (0, email_service_1.portalUrl)("/messages"),
    });
}
async function loadSessionContext(sessionId) {
    const session = await prisma_1.default.session.findUnique({ where: { id: sessionId } });
    if (!session)
        return null;
    const [coach, member] = await Promise.all([
        prisma_1.default.coach.findUnique({
            where: { id: session.coachId },
            select: {
                id: true,
                email: true,
                name: true,
                notifySessionReminders: true,
            },
        }),
        prisma_1.default.user.findUnique({
            where: { id: session.memberId },
            select: {
                id: true,
                email: true,
                name: true,
                notifySessionReminders: true,
            },
        }),
    ]);
    if (!coach || !member)
        return null;
    return { session, coach, member };
}
function sessionActionCopy(action, actor) {
    if (action === "booked") {
        return {
            title: "New session scheduled",
            line: actor === "member"
                ? "A member booked a coaching session with you."
                : "Your coach session has been scheduled.",
        };
    }
    if (action === "rescheduled") {
        return {
            title: "Session rescheduled",
            line: actor === "member"
                ? "A member requested a new time for their session."
                : "Your coach proposed a new session time.",
        };
    }
    return {
        title: "Session cancelled",
        line: actor === "member"
            ? "A member cancelled their session."
            : "Your coach cancelled the session.",
    };
}
/** Notify coach when a member books / reschedules / cancels. */
async function emailCoachSessionUpdate(sessionId, action) {
    const ctx = await loadSessionContext(sessionId);
    if (!ctx || !ctx.coach.notifySessionReminders)
        return;
    const when = (0, emailTemplates_1.formatEmailDateTime)(ctx.session.scheduledAt);
    const copy = sessionActionCopy(action, "member");
    (0, email_service_1.sendAppEmailSafe)(ctx.coach.email, copy.title, {
        title: copy.title,
        greeting: `Hi ${ctx.coach.name},`,
        lines: [
            copy.line,
            `Member: ${ctx.member.name}`,
            `When: ${when}`,
            `Type: ${ctx.session.type}`,
        ],
        ctaLabel: "View sessions",
        ctaUrl: (0, email_service_1.portalUrl)("/sessions"),
    });
}
/** Notify member when a coach reschedules / cancels. */
async function emailMemberSessionUpdate(sessionId, action) {
    const ctx = await loadSessionContext(sessionId);
    if (!ctx || !ctx.member.notifySessionReminders)
        return;
    const when = (0, emailTemplates_1.formatEmailDateTime)(ctx.session.scheduledAt);
    const copy = sessionActionCopy(action, "coach");
    (0, email_service_1.sendAppEmailSafe)(ctx.member.email, copy.title, {
        title: copy.title,
        greeting: `Hi ${ctx.member.name},`,
        lines: [
            copy.line,
            `Coach: ${ctx.coach.name}`,
            `When: ${when}`,
            `Type: ${ctx.session.type}`,
        ],
        ctaLabel: "View coaching",
        ctaUrl: (0, email_service_1.portalUrl)(`/coaching/${ctx.coach.id}`),
    });
}
/**
 * When a coach turns on-demand availability on, email all members in orgs
 * where that coach is assigned.
 */
async function emailOrgMembersCoachOnDemand(coachId) {
    const coach = await prisma_1.default.coach.findUnique({
        where: { id: coachId },
        select: { name: true, speciality: true, isActive: true },
    });
    if (!coach?.isActive)
        return;
    const orgLinks = await prisma_1.default.organizationCoach.findMany({
        where: { coachId },
        select: { organizationId: true },
    });
    const orgIds = [...new Set(orgLinks.map((l) => l.organizationId))];
    if (orgIds.length === 0)
        return;
    const members = await prisma_1.default.user.findMany({
        where: {
            organizationId: { in: orgIds },
            role: "member",
        },
        select: {
            email: true,
            name: true,
            notifySessionReminders: true,
        },
    });
    const speciality = coach.speciality ? ` · ${coach.speciality}` : "";
    for (const member of members) {
        if (!member.email || !member.notifySessionReminders)
            continue;
        (0, email_service_1.sendAppEmailSafe)(member.email, `${coach.name} is available now`, {
            title: "A coach is available on demand",
            greeting: `Hi ${member.name},`,
            lines: [
                `${coach.name}${speciality} from your organization is now available for on-demand coaching.`,
                "Sign in to book a session or send a message.",
            ],
            ctaLabel: "Find your coach",
            ctaUrl: (0, email_service_1.portalUrl)("/coaching"),
        });
    }
}
/**
 * Email the coach when a new member is assigned to them (if enabled).
 */
async function emailCoachNewClientAssigned(coachId, memberId) {
    const [coach, member] = await Promise.all([
        prisma_1.default.coach.findUnique({
            where: { id: coachId },
            select: { email: true, name: true, notifyNewClientAssigned: true },
        }),
        prisma_1.default.user.findUnique({
            where: { id: memberId },
            select: { name: true, email: true },
        }),
    ]);
    if (!coach?.email || !coach.notifyNewClientAssigned)
        return;
    const memberName = member?.name ?? "A new member";
    (0, email_service_1.sendAppEmailSafe)(coach.email, `New client assigned: ${memberName}`, {
        title: "You have a new client",
        greeting: `Hi ${coach.name},`,
        lines: [
            `${memberName} has been assigned to you as a new coaching client.`,
            "You can view their profile and start a conversation from your dashboard.",
        ],
        ctaLabel: "View my clients",
        ctaUrl: (0, email_service_1.portalUrl)("/clients"),
    });
}
async function loadOrgContact(orgId) {
    return prisma_1.default.organization.findUnique({
        where: { id: orgId },
        select: {
            id: true,
            name: true,
            primaryContactEmail: true,
            primaryContactName: true,
            notifyWeeklyReport: true,
            notifyCrisisAlerts: true,
            notifyNewMembers: true,
        },
    });
}
/** Email org contact when a member is flagged at crisis/high risk. */
async function emailOrgCrisisAlert(orgId, memberName, riskTier, detail) {
    const org = await loadOrgContact(orgId);
    if (!org?.primaryContactEmail || !org.notifyCrisisAlerts)
        return;
    (0, email_service_1.sendAppEmailSafe)(org.primaryContactEmail, `Crisis alert: ${memberName}`, {
        title: "Member needs immediate attention",
        greeting: `Hi ${org.primaryContactName},`,
        lines: [
            `${memberName} was flagged with ${riskTier} risk in ${org.name}.`,
            detail ?? "Review the member in your organization dashboard and coordinate with assigned coaches.",
        ],
        ctaLabel: "Open org dashboard",
        ctaUrl: (0, email_service_1.portalUrl)("/org/dashboard"),
    });
}
/** Notify org coaches when a new member joins the organization. */
async function emailOrgCoachesNewMember(orgId, memberId) {
    const [member, assignments] = await Promise.all([
        prisma_1.default.user.findUnique({
            where: { id: memberId },
            select: { name: true, email: true },
        }),
        prisma_1.default.organizationCoach.findMany({
            where: { organizationId: orgId },
            include: {
                coach: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        notifyNewClientAssigned: true,
                        isActive: true,
                    },
                },
            },
        }),
    ]);
    if (!member)
        return;
    const memberName = member.name ?? "A new member";
    for (const row of assignments) {
        const coach = row.coach;
        if (!coach.isActive || !coach.email || !coach.notifyNewClientAssigned)
            continue;
        (0, email_service_1.sendAppEmailSafe)(coach.email, `New member in your organization: ${memberName}`, {
            title: "New member joined your organization",
            greeting: `Hi ${coach.name},`,
            lines: [
                `${memberName} (${member.email ?? "no email"}) joined your organization and may book sessions with you.`,
                "Check your clients list when you're ready to connect.",
            ],
            ctaLabel: "View clients",
            ctaUrl: (0, email_service_1.portalUrl)("/clients"),
        });
    }
}
/** Immediate org contact email when a member joins (if daily digest is enabled). */
async function emailOrgNewMemberJoined(orgId, memberId) {
    const [org, member] = await Promise.all([
        loadOrgContact(orgId),
        prisma_1.default.user.findUnique({
            where: { id: memberId },
            select: { name: true, email: true, createdAt: true },
        }),
    ]);
    if (!org?.primaryContactEmail || !org.notifyNewMembers || !member)
        return;
    (0, email_service_1.sendAppEmailSafe)(org.primaryContactEmail, `New member joined ${org.name}`, {
        title: "New member joined",
        greeting: `Hi ${org.primaryContactName},`,
        lines: [
            `${member.name} (${member.email}) joined ${org.name}.`,
            "Assigned coaches have been notified. You can review members in your dashboard.",
        ],
        ctaLabel: "View members",
        ctaUrl: (0, email_service_1.portalUrl)("/org/dashboard"),
    });
}
/** Called when a member is linked to an organization — coaches notified immediately; org contact gets daily digest. */
async function notifyOrganizationMemberJoined(orgId, memberId) {
    await emailOrgCoachesNewMember(orgId, memberId);
}
/** Weekly outcomes email for organizations with notifyWeeklyReport enabled. */
async function emailOrgWeeklyOutcomeReport(orgId) {
    const org = await loadOrgContact(orgId);
    if (!org?.primaryContactEmail || !org.notifyWeeklyReport)
        return;
    const { buildOrgOutcomesMetrics, buildOrgOverviewMetrics } = await Promise.resolve().then(() => __importStar(require("./orgStats.service")));
    const [overview, outcomes] = await Promise.all([
        buildOrgOverviewMetrics(orgId),
        buildOrgOutcomesMetrics(orgId),
    ]);
    (0, email_service_1.sendAppEmailSafe)(org.primaryContactEmail, `Weekly outcomes — ${org.name}`, {
        title: "Weekly Outcome Report",
        greeting: `Hi ${org.primaryContactName},`,
        lines: [
            `Members: ${overview.totalMembers} total, ${overview.activeMembers} active (30d)`,
            `Sessions this month: ${overview.sessionsThisMonth}`,
            overview.avgPhqScore !== null
                ? `Average PHQ-8 score: ${overview.avgPhqScore}`
                : "Average PHQ-8 score: not yet available",
            outcomes.retentionRate !== null
                ? `30-day retention: ${outcomes.retentionRate}%`
                : "30-day retention: not yet available",
            "Sign in for full charts and downloadable reports.",
        ],
        ctaLabel: "View outcomes",
        ctaUrl: (0, email_service_1.portalUrl)("/org/outcomes"),
    });
}
/** Daily digest of members who joined in the last 24 hours. */
async function emailOrgDailyNewMemberDigest(orgId) {
    const org = await loadOrgContact(orgId);
    if (!org?.primaryContactEmail || !org.notifyNewMembers)
        return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const members = await prisma_1.default.user.findMany({
        where: { organizationId: orgId, createdAt: { gte: since } },
        select: { name: true, email: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    });
    if (members.length === 0)
        return;
    const lines = members.map((m) => `• ${m.name} (${m.email}) — ${(0, emailTemplates_1.formatEmailDateTime)(m.createdAt)}`);
    (0, email_service_1.sendAppEmailSafe)(org.primaryContactEmail, `New members digest — ${org.name}`, {
        title: "Daily new member digest",
        greeting: `Hi ${org.primaryContactName},`,
        lines: [
            `${members.length} member(s) joined ${org.name} in the last 24 hours:`,
            ...lines,
        ],
        ctaLabel: "View dashboard",
        ctaUrl: (0, email_service_1.portalUrl)("/org/dashboard"),
    });
}
