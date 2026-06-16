import prisma from "../lib/prisma";
import { formatEmailDateTime } from "./emailTemplates";
import { portalUrl, sendAppEmailSafe } from "./email.service";

const MESSAGE_ALERT_THROTTLE_MS = 60 * 60 * 1000;
const messageAlertSentAt = new Map<string, number>();

function throttleKey(coachId: string, memberId: string): string {
  return `${coachId}:${memberId}`;
}

function canSendMessageAlert(coachId: string, memberId: string): boolean {
  const key = throttleKey(coachId, memberId);
  const last = messageAlertSentAt.get(key) ?? 0;
  if (Date.now() - last < MESSAGE_ALERT_THROTTLE_MS) return false;
  messageAlertSentAt.set(key, Date.now());
  return true;
}

/**
 * When a member has more than 2 unread messages, email the coach (if enabled).
 * Throttled to once per hour per member thread.
 */
export async function maybeEmailCoachUnreadMessages(
  coachId: string,
  memberId: string
): Promise<void> {
  const [coach, member, unreadCount] = await Promise.all([
    prisma.coach.findUnique({
      where: { id: coachId },
      select: { email: true, name: true, notifyMessageAlerts: true },
    }),
    prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true },
    }),
    prisma.coachMessage.count({
      where: {
        coachId,
        userId: memberId,
        senderRole: "member",
        read: false,
      },
    }),
  ]);

  if (!coach?.email || !coach.notifyMessageAlerts) return;
  if (unreadCount <= 2) return;
  if (!canSendMessageAlert(coachId, memberId)) return;

  const memberName = member?.name ?? "A member";

  sendAppEmailSafe(coach.email, `New messages from ${memberName}`, {
    title: "You have unread messages",
    greeting: `Hi ${coach.name},`,
    lines: [
      `${memberName} has ${unreadCount} unread messages waiting for you in the portal.`,
      "Open your inbox to reply when you have a moment.",
    ],
    ctaLabel: "View messages",
    ctaUrl: portalUrl("/messages"),
  });
}

export type SessionEmailAction = "booked" | "rescheduled" | "cancelled";

async function loadSessionContext(sessionId: string) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;

  const [coach, member] = await Promise.all([
    prisma.coach.findUnique({
      where: { id: session.coachId },
      select: {
        id: true,
        email: true,
        name: true,
        notifySessionReminders: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.memberId },
      select: {
        id: true,
        email: true,
        name: true,
        notifySessionReminders: true,
      },
    }),
  ]);

  if (!coach || !member) return null;
  return { session, coach, member };
}

function sessionActionCopy(
  action: SessionEmailAction,
  actor: "member" | "coach"
): { title: string; line: string } {
  if (action === "booked") {
    return {
      title: "New session scheduled",
      line:
        actor === "member"
          ? "A member booked a coaching session with you."
          : "Your coach session has been scheduled.",
    };
  }
  if (action === "rescheduled") {
    return {
      title: "Session rescheduled",
      line:
        actor === "member"
          ? "A member requested a new time for their session."
          : "Your coach proposed a new session time.",
    };
  }
  return {
    title: "Session cancelled",
    line:
      actor === "member"
        ? "A member cancelled their session."
        : "Your coach cancelled the session.",
  };
}

/** Notify coach when a member books / reschedules / cancels. */
export async function emailCoachSessionUpdate(
  sessionId: string,
  action: SessionEmailAction
): Promise<void> {
  const ctx = await loadSessionContext(sessionId);
  if (!ctx || !ctx.coach.notifySessionReminders) return;

  const when = formatEmailDateTime(ctx.session.scheduledAt);
  const copy = sessionActionCopy(action, "member");

  sendAppEmailSafe(ctx.coach.email, copy.title, {
    title: copy.title,
    greeting: `Hi ${ctx.coach.name},`,
    lines: [
      copy.line,
      `Member: ${ctx.member.name}`,
      `When: ${when}`,
      `Type: ${ctx.session.type}`,
    ],
    ctaLabel: "View sessions",
    ctaUrl: portalUrl("/sessions"),
  });
}

/** Notify member when a coach reschedules / cancels. */
export async function emailMemberSessionUpdate(
  sessionId: string,
  action: SessionEmailAction
): Promise<void> {
  const ctx = await loadSessionContext(sessionId);
  if (!ctx || !ctx.member.notifySessionReminders) return;

  const when = formatEmailDateTime(ctx.session.scheduledAt);
  const copy = sessionActionCopy(action, "coach");

  sendAppEmailSafe(ctx.member.email, copy.title, {
    title: copy.title,
    greeting: `Hi ${ctx.member.name},`,
    lines: [
      copy.line,
      `Coach: ${ctx.coach.name}`,
      `When: ${when}`,
      `Type: ${ctx.session.type}`,
    ],
    ctaLabel: "View coaching",
    ctaUrl: portalUrl(`/coaching/${ctx.coach.id}`),
  });
}

/**
 * When a coach turns on-demand availability on, email all members in orgs
 * where that coach is assigned.
 */
export async function emailOrgMembersCoachOnDemand(coachId: string): Promise<void> {
  const coach = await prisma.coach.findUnique({
    where: { id: coachId },
    select: { name: true, speciality: true, isActive: true },
  });
  if (!coach?.isActive) return;

  const orgLinks = await prisma.organizationCoach.findMany({
    where: { coachId },
    select: { organizationId: true },
  });
  const orgIds = [...new Set(orgLinks.map((l) => l.organizationId))];
  if (orgIds.length === 0) return;

  const members = await prisma.user.findMany({
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
    if (!member.email || !member.notifySessionReminders) continue;

    sendAppEmailSafe(
      member.email,
      `${coach.name} is available now`,
      {
        title: "A coach is available on demand",
        greeting: `Hi ${member.name},`,
        lines: [
          `${coach.name}${speciality} from your organization is now available for on-demand coaching.`,
          "Sign in to book a session or send a message.",
        ],
        ctaLabel: "Find your coach",
        ctaUrl: portalUrl("/coaching"),
      }
    );
  }
}

/**
 * Email the coach when a new member is assigned to them (if enabled).
 */
export async function emailCoachNewClientAssigned(
  coachId: string,
  memberId: string
): Promise<void> {
  const [coach, member] = await Promise.all([
    prisma.coach.findUnique({
      where: { id: coachId },
      select: { email: true, name: true, notifyNewClientAssigned: true },
    }),
    prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true, email: true },
    }),
  ]);

  if (!coach?.email || !coach.notifyNewClientAssigned) return;

  const memberName = member?.name ?? "A new member";

  sendAppEmailSafe(coach.email, `New client assigned: ${memberName}`, {
    title: "You have a new client",
    greeting: `Hi ${coach.name},`,
    lines: [
      `${memberName} has been assigned to you as a new coaching client.`,
      "You can view their profile and start a conversation from your dashboard.",
    ],
    ctaLabel: "View my clients",
    ctaUrl: portalUrl("/clients"),
  });
}

async function loadOrgContact(orgId: string) {
  return prisma.organization.findUnique({
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
export async function emailOrgCrisisAlert(
  orgId: string,
  memberName: string,
  riskTier: string,
  detail?: string
): Promise<void> {
  const org = await loadOrgContact(orgId);
  if (!org?.primaryContactEmail || !org.notifyCrisisAlerts) return;

  sendAppEmailSafe(org.primaryContactEmail, `Crisis alert: ${memberName}`, {
    title: "Member needs immediate attention",
    greeting: `Hi ${org.primaryContactName},`,
    lines: [
      `${memberName} was flagged with ${riskTier} risk in ${org.name}.`,
      detail ?? "Review the member in your organization dashboard and coordinate with assigned coaches.",
    ],
    ctaLabel: "Open org dashboard",
    ctaUrl: portalUrl("/org/dashboard"),
  });
}

/** Notify org coaches when a new member joins the organization. */
export async function emailOrgCoachesNewMember(
  orgId: string,
  memberId: string
): Promise<void> {
  const [member, assignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true, email: true },
    }),
    prisma.organizationCoach.findMany({
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

  if (!member) return;
  const memberName = member.name ?? "A new member";

  for (const row of assignments) {
    const coach = row.coach;
    if (!coach.isActive || !coach.email || !coach.notifyNewClientAssigned) continue;
    sendAppEmailSafe(coach.email, `New member in your organization: ${memberName}`, {
      title: "New member joined your organization",
      greeting: `Hi ${coach.name},`,
      lines: [
        `${memberName} (${member.email ?? "no email"}) joined your organization and may book sessions with you.`,
        "Check your clients list when you're ready to connect.",
      ],
      ctaLabel: "View clients",
      ctaUrl: portalUrl("/clients"),
    });
  }
}

/** Immediate org contact email when a member joins (if daily digest is enabled). */
export async function emailOrgNewMemberJoined(
  orgId: string,
  memberId: string
): Promise<void> {
  const [org, member] = await Promise.all([
    loadOrgContact(orgId),
    prisma.user.findUnique({
      where: { id: memberId },
      select: { name: true, email: true, createdAt: true },
    }),
  ]);
  if (!org?.primaryContactEmail || !org.notifyNewMembers || !member) return;

  sendAppEmailSafe(org.primaryContactEmail, `New member joined ${org.name}`, {
    title: "New member joined",
    greeting: `Hi ${org.primaryContactName},`,
    lines: [
      `${member.name} (${member.email}) joined ${org.name}.`,
      "Assigned coaches have been notified. You can review members in your dashboard.",
    ],
    ctaLabel: "View members",
    ctaUrl: portalUrl("/org/dashboard"),
  });
}

/** Called when a member is linked to an organization — coaches notified immediately; org contact gets daily digest. */
export async function notifyOrganizationMemberJoined(
  orgId: string,
  memberId: string
): Promise<void> {
  await emailOrgCoachesNewMember(orgId, memberId);
}

/** Weekly outcomes email for organizations with notifyWeeklyReport enabled. */
export async function emailOrgWeeklyOutcomeReport(orgId: string): Promise<void> {
  const org = await loadOrgContact(orgId);
  if (!org?.primaryContactEmail || !org.notifyWeeklyReport) return;

  const { buildOrgOutcomesMetrics, buildOrgOverviewMetrics } = await import("./orgStats.service");
  const overview = await buildOrgOverviewMetrics(orgId);
  const outcomes = await buildOrgOutcomesMetrics(orgId);

  sendAppEmailSafe(org.primaryContactEmail, `Weekly outcomes — ${org.name}`, {
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
    ctaUrl: portalUrl("/org/outcomes"),
  });
}

/** Daily digest of members who joined in the last 24 hours. */
export async function emailOrgDailyNewMemberDigest(orgId: string): Promise<void> {
  const org = await loadOrgContact(orgId);
  if (!org?.primaryContactEmail || !org.notifyNewMembers) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const members = await prisma.user.findMany({
    where: { organizationId: orgId, createdAt: { gte: since } },
    select: { name: true, email: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (members.length === 0) return;

  const lines = members.map(
    (m) => `• ${m.name} (${m.email}) — ${formatEmailDateTime(m.createdAt)}`
  );

  sendAppEmailSafe(
    org.primaryContactEmail,
    `New members digest — ${org.name}`,
    {
      title: "Daily new member digest",
      greeting: `Hi ${org.primaryContactName},`,
      lines: [
        `${members.length} member(s) joined ${org.name} in the last 24 hours:`,
        ...lines,
      ],
      ctaLabel: "View dashboard",
      ctaUrl: portalUrl("/org/dashboard"),
    }
  );
}
