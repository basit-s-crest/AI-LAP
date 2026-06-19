"use client";

import { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import api, { resolveApiUrl } from "@/lib/api";
import { AUTH_TOKEN_KEY } from "@/constants/storage";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { getReadNotificationIds } from "@/lib/notificationReadStore";
import { addNotification, setNotifications } from "@/store/slices/notificationSlice";
import { mergeFetchedNotifications } from "@/lib/notificationMerge";
import type { AppNotification } from "@/types/notification";
import type { CoachMessageDTO, ConversationSummary } from "@/types/coachMessage";
import { isViewingMemberThread } from "@/lib/activeView";
import { useActiveView } from "@/hooks/useActiveView";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(name) + "=";
  const match = document.cookie.split("; ").find((row) => row.startsWith(encoded));
  return match ? decodeURIComponent(match.slice(encoded.length)) : null;
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

async function markCoachThreadRead(memberUserId: string): Promise<void> {
  await api.post(`/api/coach-messages/${memberUserId}/read`).catch(() => {});
}

export function useCoachNotifications(enabled: boolean) {
  const dispatch = useAppDispatch();
  const coachId = useAppSelector((s) => s.auth.user?.id);
  const activeView = useActiveView();
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;
  const existingItems = useAppSelector((s) => s.notification.items);
  const existingItemsRef = useRef(existingItems);
  existingItemsRef.current = existingItems;
  const socketRef = useRef<Socket | null>(null);

  const fetchAll = useCallback(async () => {
    if (!enabled || !coachId) return;

    const items: AppNotification[] = [];

    try {
      const { data: conversations } = await api.get<ConversationSummary[]>(
        "/api/coach-messages"
      );
      const view = activeViewRef.current;
      for (const conv of conversations) {
        if (conv.unreadCount <= 0) continue;
        if (isViewingMemberThread(view, conv.partnerId)) {
          void markCoachThreadRead(conv.partnerId);
          continue;
        }
        items.push({
          id: `coach-member-unread-${conv.partnerId}`,
          title: `Message from ${conv.partnerName}`,
          message: conv.lastMessage || "New message",
          read: false,
          createdAt: conv.lastMessageAt,
          severity: "info",
          link: `/messages?partner=${encodeURIComponent(conv.partnerId)}`,
        });
      }
    } catch {
      /* ignore */
    }

    const merged = mergeFetchedNotifications(items, existingItemsRef.current);
    merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    dispatch(
      setNotifications(applyPersistedReadState(coachId, merged, existingItemsRef.current))
    );
  }, [dispatch, enabled, coachId]);

  useEffect(() => {
    if (!enabled) return;
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 60_000);
    return () => clearInterval(interval);
  }, [enabled, fetchAll]);

  useEffect(() => {
    if (!enabled || !coachId) return;

    const token = readCookie(AUTH_TOKEN_KEY);
    const socket = io(`${resolveApiUrl(BACKEND_URL)}/coach-chat`, {
      auth: { token },
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("new_message", (msg: CoachMessageDTO) => {
      if (msg.senderRole !== "member" || msg.coachId !== coachId) return;

      if (isViewingMemberThread(activeViewRef.current, msg.userId)) {
        void markCoachThreadRead(msg.userId);
        return;
      }

      dispatch(
        addNotification({
          id: `coach-msg-${msg.id}`,
          title: `Message from member`,
          message: msg.content.length > 80 ? `${msg.content.slice(0, 80)}…` : msg.content,
          read: false,
          createdAt: msg.createdAt,
          severity: "info",
          link: `/messages?partner=${encodeURIComponent(msg.userId)}`,
        })
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [dispatch, enabled, coachId]);

  return { refresh: fetchAll };
}
