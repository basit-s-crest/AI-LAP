import type { AppNotification } from "@/types/notification";

/** Keep realtime socket notifications when polling replaces the list. */
export function mergeFetchedNotifications(
  fetched: AppNotification[],
  existing: AppNotification[]
): AppNotification[] {
  const fetchedIds = new Set(fetched.map((n) => n.id));
  const preserved = existing.filter(
    (n) =>
      !fetchedIds.has(n.id) &&
      (n.id.startsWith("coach-msg-") ||
        n.id.startsWith("group-post-") ||
        n.id.startsWith("group-join-"))
  );
  const combined = [...fetched, ...preserved];
  combined.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return combined;
}
