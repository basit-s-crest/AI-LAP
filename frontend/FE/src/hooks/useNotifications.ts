"use client";

import { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";
import { AUTH_TOKEN_KEY } from "@/constants/storage";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { getReadNotificationIds } from "@/lib/notificationReadStore";
import { addNotification, setNotifications } from "@/store/slices/notificationSlice";
import { mergeFetchedNotifications } from "@/lib/notificationMerge";
import type { AppNotification } from "@/types/notification";
import type { CoachMessageDTO } from "@/types/coachMessage";
import { resolveMemberCoachMessageLink } from "@/lib/memberCoachChat";
import {
  isViewingCoachChat,
  isViewingCommunityGroup,
} from "@/lib/activeView";
import { useActiveView } from "@/hooks/useActiveView";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(name) + "=";
  const match = document.cookie.split("; ").find((row) => row.startsWith(encoded));
  return match ? decodeURIComponent(match.slice(encoded.length)) : null;
}

export function localTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface MemberSession {
  id: string;
  status: string;
  scheduledAt: string;
  rescheduleRequest: string | null;
}

interface RecentPost {
  id: string;
  groupId: string;
  groupName: string;
  groupEmoji?: string;
  memberName: string;
  body?: string;
  createdAt: string;
}

interface RecentJoin {
  id: string;
  groupId: string;
  groupName: string;
  groupEmoji?: string;
  memberName: string;
  joinedAt: string;
}

interface GroupPostEvent {
  id: string;
  groupId: string;
  groupName: string;
  groupEmoji?: string;
  memberName: string;
  body: string;
  createdAt: string;
}

interface GroupJoinEvent {
  id: string;
  groupId: string;
  groupName: string;
  memberName: string;
  joinedAt: string;
}

interface MemberNotificationPrefs {
  notifyGroupActivity: boolean;
  notifySessionReminders: boolean;
  notifyDailyCheckin: boolean;
  notifyWeeklySummary: boolean;
}

function applyPersistedReadState(
  userId: string,
  items: AppNotification[],
  existing: AppNotification[]
): AppNotification[] {
  const readIds = getReadNotificationIds(userId);
  const existingRead = new Set(existing.filter((n) => n.read).map((n) => n.id));
  return items.map((item) => ({
    ...item,
    read: item.read || readIds.has(item.id) || existingRead.has(item.id),
  }));
}

function groupLink(groupId: string): string {
  return `/community-groups/${groupId}`;
}

async function markMemberThreadRead(coachId: string): Promise<void> {
  await api.post(`/api/coach-messages/${coachId}/read`).catch(() => {});
}

export function useNotifications(enabled: boolean) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const activeView = useActiveView();
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const existingItems = useAppSelector((s) => s.notification.items);
  const existingItemsRef = useRef(existingItems);
  existingItemsRef.current = existingItems;
  const socketRef = useRef<Socket | null>(null);
  const prefRef = useRef<MemberNotificationPrefs>({
    notifyGroupActivity: true,
    notifySessionReminders: true,
    notifyDailyCheckin: true,
    notifyWeeklySummary: true,
  });

  const fetchAll = useCallback(async () => {
    if (!enabled || !userId) return;

    const items: AppNotification[] = [];
    const now = new Date().toISOString();
    const dayKey = localTodayKey();
    let prefs = prefRef.current;

    try {
      const { data: profile } = await api.get<{ notifications: MemberNotificationPrefs }>(
        "/api/auth/profile"
      );
      if (profile?.notifications) {
        prefs = profile.notifications;
        prefRef.current = profile.notifications;
      }
    } catch {
      /* ignore profile preference fetch errors */
    }

    if (prefs.notifyDailyCheckin) {
      try {
        const { data: moodToday } = await api.get<{ logged: boolean }>("/api/mood/today");
        if (!moodToday.logged) {
          items.push({
            id: `mood-reminder-${dayKey}`,
            title: "Log your mood 🌿",
            message: "How are you feeling today? Tap to check in",
            read: false,
            createdAt: now,
            severity: "info",
            link: "/mood-mapping",
          });
        }
      } catch {
        /* ignore mood fetch errors */
      }
    }

    try {
      const { data: unread } = await api.get<{ count: number }>("/api/coach-messages/unread-count");
      if (unread.count > 0) {
        const chatLink = await resolveMemberCoachMessageLink();
        const coachIdFromLink = chatLink.match(/^\/coaching\/([^/?#]+)/)?.[1];
        const view = activeViewRef.current;
        if (coachIdFromLink && isViewingCoachChat(view, coachIdFromLink)) {
          void markMemberThreadRead(coachIdFromLink);
        } else {
          items.push({
            id: "coach-messages-unread",
            title: "New message from your coach 💬",
            message: `${unread.count} unread message${unread.count === 1 ? "" : "s"}`,
            read: false,
            createdAt: now,
            severity: "info",
            link: chatLink,
          });
        }
      }
    } catch {
      /* ignore */
    }

    if (prefs.notifySessionReminders) {
      try {
        const { data: sessions } = await api.get<MemberSession[]>("/api/sessions/member");
        for (const session of sessions) {
          if (session.status === "pending" && session.rescheduleRequest) {
            items.push({
              id: `session-reschedule-${session.id}`,
              title: "Session rescheduled 📅",
              message: `Your coach proposed a new time for ${formatSessionDate(session.rescheduleRequest)}`,
              read: false,
              createdAt: session.rescheduleRequest,
              severity: "warning",
              link: "/coaching",
            });
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (prefs.notifyGroupActivity) {
      try {
        const { data: posts } = await api.get<RecentPost[]>("/api/groups/recent-posts");
        const view = activeViewRef.current;
        for (const post of posts) {
          if (isViewingCommunityGroup(view, post.groupId)) continue;
          const preview =
            post.body && post.body.length > 60
              ? `${post.body.slice(0, 60)}…`
              : post.body || "posted something";
          items.push({
            id: `group-post-${post.id}`,
            title: `New post in ${post.groupName} 👥`,
            message: `${post.memberName}: ${preview}`,
            read: false,
            createdAt:
              typeof post.createdAt === "string"
                ? post.createdAt
                : new Date(post.createdAt).toISOString(),
            severity: "info",
            link: groupLink(post.groupId),
          });
        }
      } catch {
        /* ignore */
      }

      try {
        const { data: joins } = await api.get<RecentJoin[]>("/api/groups/recent-joins");
        for (const join of joins) {
          if (isViewingCommunityGroup(activeViewRef.current, join.groupId)) continue;
          items.push({
            id: `group-join-${join.id}`,
            title: `New member in ${join.groupName}`,
            message: `${join.memberName} just joined`,
            read: false,
            createdAt:
              typeof join.joinedAt === "string"
                ? join.joinedAt
                : new Date(join.joinedAt).toISOString(),
            severity: "info",
            link: groupLink(join.groupId),
          });
        }
      } catch {
        /* ignore */
      }
    }

    const merged = mergeFetchedNotifications(items, existingItemsRef.current);
    merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    dispatch(
      setNotifications(applyPersistedReadState(userId, merged, existingItemsRef.current))
    );
  }, [dispatch, enabled, userId]);

  useEffect(() => {
    if (!enabled) return;
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 60_000);
    return () => clearInterval(interval);
  }, [enabled, fetchAll]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const token = readCookie(AUTH_TOKEN_KEY);
    const socket = io(`${BACKEND_URL}/coach-chat`, {
      auth: { token },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("new_message", (msg: CoachMessageDTO) => {
      if (msg.senderRole !== "coach" || msg.userId !== userId) return;

      if (isViewingCoachChat(activeViewRef.current, msg.coachId)) {
        void markMemberThreadRead(msg.coachId);
        return;
      }

      dispatch(
        addNotification({
          id: `coach-msg-${msg.id}`,
          title: "New message from your coach 💬",
          message: msg.content.length > 80 ? `${msg.content.slice(0, 80)}…` : msg.content,
          read: false,
          createdAt: msg.createdAt,
          severity: "info",
          link: `/coaching/${msg.coachId}`,
        })
      );
    });

    socket.on("group_post", (post: GroupPostEvent) => {
      if (!prefRef.current.notifyGroupActivity) return;
      if (isViewingCommunityGroup(activeViewRef.current, post.groupId)) return;
      const preview =
        post.body.length > 60 ? `${post.body.slice(0, 60)}…` : post.body;
      dispatch(
        addNotification({
          id: `group-post-${post.id}`,
          title: `New post in ${post.groupName} 👥`,
          message: `${post.memberName}: ${preview}`,
          read: false,
          createdAt: post.createdAt,
          severity: "info",
          link: groupLink(post.groupId),
        })
      );
    });

    socket.on("group_join", (join: GroupJoinEvent) => {
      if (!prefRef.current.notifyGroupActivity) return;
      if (isViewingCommunityGroup(activeViewRef.current, join.groupId)) return;
      dispatch(
        addNotification({
          id: `group-join-${join.id}`,
          title: `New member in ${join.groupName}`,
          message: `${join.memberName} just joined`,
          read: false,
          createdAt: join.joinedAt,
          severity: "info",
          link: groupLink(join.groupId),
        })
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dispatch, enabled, userId]);

  return { refresh: fetchAll };
}

