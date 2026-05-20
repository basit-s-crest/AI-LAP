import api from "@/lib/api";
import type { ConversationSummary } from "@/types/coachMessage";

/** Member portal chat lives at /coaching/:coachId — never /messages (coach UI). */
export async function resolveMemberCoachMessageLink(
  coachId?: string
): Promise<string> {
  if (coachId) return `/coaching/${coachId}`;

  try {
    const { data: conversations } = await api.get<ConversationSummary[]>(
      "/api/coach-messages"
    );
    const withUnread = conversations
      .filter((c) => c.unreadCount > 0)
      .sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    if (withUnread.length > 0) return `/coaching/${withUnread[0].partnerId}`;

    if (conversations.length > 0) {
      const sorted = [...conversations].sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
      return `/coaching/${sorted[0].partnerId}`;
    }
  } catch {
    /* ignore */
  }

  try {
    const { data } = await api.get<{ coaches: { id: string }[] }>("/api/coach/list");
    if (data.coaches?.length === 1) return `/coaching/${data.coaches[0].id}`;
  } catch {
    /* ignore */
  }

  return "/coaching";
}
