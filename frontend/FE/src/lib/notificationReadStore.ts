const STORAGE_PREFIX = "vasl_notif_read_";

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function getReadNotificationIds(userId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string, ids: Set<string>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify([...ids]));
}

export function markNotificationRead(userId: string, id: string): void {
  const ids = getReadNotificationIds(userId);
  ids.add(id);
  saveReadIds(userId, ids);
}

export function markAllNotificationsRead(userId: string, notificationIds: string[]): void {
  const ids = getReadNotificationIds(userId);
  for (const id of notificationIds) ids.add(id);
  saveReadIds(userId, ids);
}

export function clearReadNotifications(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(userId));
}

/** Remove persisted read state for all users (e.g. on logout). */
export function clearAllReadNotifications(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}
