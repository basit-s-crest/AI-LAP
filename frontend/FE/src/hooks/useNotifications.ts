"use client";

import { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import api from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { getReadNotificationIds } from "@/lib/notificationReadStore";
import { addNotification, setNotifications } from "@/store/slices/notificationSlice";
import type { AppNotification } from "@/types/notification";
import type { CoachMessageDTO } from "@/types/coachMessage";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(name) + "=";
  const match = document.cookie.split("; ").find((row) => row.startsWith(encoded));
  return match ? decodeURIComponent(match.slice(encoded.length)) : null;
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
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
  groupName: string;
  memberName: string;
  createdAt: string;
}

interface RecentJoin {
  id: string;
  groupName: string;
  memberName: string;
  joinedAt: string;
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

export function useNotifications(enabled: boolean) {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const existingItems = useAppSelector((s) => s.notification.items);
  const existingItemsRef = useRef(existingItems);
  existingItemsRef.current = existingItems;
  const socketRef = useRef<Socket | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled || !userId) return;

    const items: AppNotification[] = [];
    const now = new Date().toISOString();

    try {
      const { data: moodToday } = await api.get<{ logged: boolean }>("/api/mood/today");
      const reminderKey = `mood_reminder_${todayKey()}`;
      if (!moodToday.logged && typeof window !== "undefined" && !localStorage.getItem(reminderKey)) {
        localStorage.setItem(reminderKey, "1");
        items.push({
          id: `mood-reminder-${todayKey()}`,
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

    try {
      const { data: unread } = await api.get<{ count: number }>("/api/coach-messages/unread-count");
      if (unread.count > 0) {
        items.push({
          id: "coach-messages-unread",
          title: "New message from your coach 💬",
          message: `${unread.count} unread message${unread.count === 1 ? "" : "s"}`,
          read: false,
          createdAt: now,
          severity: "info",
          link: "/messages",
        });
      }
    } catch {
      /* ignore */
    }

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

    try {
      const { data: posts } = await api.get<RecentPost[]>("/api/groups/recent-posts");
      for (const post of posts) {
        items.push({
          id: `group-post-${post.id}`,
          title: `New post in ${post.groupName} 👥`,
          message: `${post.memberName} posted something`,
          read: false,
          createdAt: post.createdAt,
          severity: "info",
          link: "/community-groups",
        });
      }
    } catch {
      /* ignore */
    }

    try {
      const { data: joins } = await api.get<RecentJoin[]>("/api/groups/recent-joins");
      for (const join of joins) {
        items.push({
          id: `group-join-${join.id}`,
          title: `New member in ${join.groupName}`,
          message: `${join.memberName} just joined`,
          read: false,
          createdAt: join.joinedAt,
          severity: "info",
          link: "/community-groups",
        });
      }
    } catch {
      /* ignore */
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    dispatch(
      setNotifications(applyPersistedReadState(userId, items, existingItemsRef.current))
    );
  }, [dispatch, enabled, userId]);

  useEffect(() => {
    if (!enabled) return;
    void fetchAll();
  }, [enabled, fetchAll]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const token = readCookie("azadi_token");
    const socket = io(`${BACKEND_URL}/coach-chat`, {
      auth: { token },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("new_message", (msg: CoachMessageDTO) => {
      if (msg.senderRole !== "coach" || msg.userId !== userId) return;

      dispatch(
        addNotification({
          id: `coach-msg-${msg.id}`,
          title: "New message from your coach 💬",
          message: msg.content.length > 80 ? `${msg.content.slice(0, 80)}…` : msg.content,
          read: false,
          createdAt: msg.createdAt,
          severity: "info",
          link: "/messages",
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
