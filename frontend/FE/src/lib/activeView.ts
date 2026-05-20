/** Tracks which chat/group the user is currently viewing (for notification suppression). */

export type ActiveView =
  | { kind: "coach-chat"; coachId: string }
  | { kind: "coach-messages"; partnerId: string | null }
  | { kind: "community-group"; groupId: string }
  | { kind: "mood-mapping" }
  | null;

let activeCoachMessagesPartner: string | null = null;

/** Set by coach /messages page when a thread is selected (covers URL without ?partner). */
export function setActiveCoachMessagesPartner(partnerId: string | null): void {
  activeCoachMessagesPartner = partnerId;
}

export function getActiveCoachMessagesPartner(): string | null {
  return activeCoachMessagesPartner;
}

export function parseActiveView(
  pathname: string,
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): ActiveView {
  if (pathname === "/mood-mapping") return { kind: "mood-mapping" };

  const coachMatch = pathname.match(/^\/coaching\/([^/?#]+)/);
  if (coachMatch) return { kind: "coach-chat", coachId: coachMatch[1] };

  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return {
      kind: "coach-messages",
      partnerId:
        searchParams.get("partner") ?? getActiveCoachMessagesPartner(),
    };
  }

  const groupMatch = pathname.match(/^\/community-groups\/([^/?#]+)/);
  if (groupMatch) return { kind: "community-group", groupId: groupMatch[1] };

  return null;
}

/** Member is on the coach chat thread. */
export function isViewingCoachChat(view: ActiveView, coachId: string): boolean {
  return view?.kind === "coach-chat" && view.coachId === coachId;
}

/** Coach is on the member's thread in /messages. */
export function isViewingMemberThread(view: ActiveView, memberUserId: string): boolean {
  if (view?.kind !== "coach-messages") return false;
  return view.partnerId === memberUserId;
}

export function isViewingCommunityGroup(view: ActiveView, groupId: string): boolean {
  return view?.kind === "community-group" && view.groupId === groupId;
}
