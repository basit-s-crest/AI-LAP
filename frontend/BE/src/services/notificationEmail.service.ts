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

  sendAppEmailSafe(coach.email, `New messages from ${memberName} · Azadi Health`, {
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

  sendAppEmailSafe(ctx.coach.email, `${copy.title} · Azadi Health`, {
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

  sendAppEmailSafe(ctx.member.email, `${copy.title} · Azadi Health`, {
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
      `${coach.name} is available now · Azadi Health`,
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
