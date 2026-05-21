"use client";

import { useCallback, useEffect, useRef } from "react";
import api from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { getReadNotificationIds } from "@/lib/notificationReadStore";
import { addNotification, setNotifications } from "@/store/slices/notificationSlice";
import { mergeFetchedNotifications } from "@/lib/notificationMerge";
import type { AppNotification } from "@/types/notification";
import type { ScoreUpdateEvent } from "@/lib/vasl/types";
import type { OrgMember } from "@/hooks/org/useOrgMembers";
import type { OrgSettings } from "@/hooks/org/useOrgSettings";

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

function weekKey(d = new Date()): string {
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay());
  return `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
}

const DEFAULT_PREFS = {
  notifyWeeklyReport: true,
  notifyCrisisAlerts: true,
  notifyNewMembers: true,
};

export function useOrgNotifications(enabled: boolean) {
  const dispatch = useAppDispatch();
  const orgUserId = useAppSelector((s) => s.auth.user?.id);
  const existingItems = useAppSelector((s) => s.notification.items);
  const existingItemsRef = useRef(existingItems);
  existingItemsRef.current = existingItems;
  const memberIdsRef = useRef<Set<string>>(new Set());
  const prefRef = useRef(DEFAULT_PREFS);

  const fetchAll = useCallback(async () => {
    if (!enabled || !orgUserId) return;

    const items: AppNotification[] = [];
    const now = new Date().toISOString();
    let prefs = prefRef.current;

    try {
      const { data: settings } = await api.get<OrgSettings>("/api/org/settings");
      prefs = {
        notifyWeeklyReport: settings.notifyWeeklyReport,
        notifyCrisisAlerts: settings.notifyCrisisAlerts,
        notifyNewMembers: settings.notifyNewMembers,
      };
      prefRef.current = prefs;
    } catch {
      /* use cached prefs */
    }

    try {
      const { data: members } = await api.get<OrgMember[]>("/api/org/members");
      memberIdsRef.current = new Set(members.map((m) => m.id));

      if (prefs.notifyNewMembers) {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        for (const member of members) {
          const joined = new Date(member.createdAt).getTime();
          if (joined < weekAgo) continue;
          items.push({
            id: `org-new-member-${member.id}`,
            title: member.isVerified ? "New member joined" : "New member (pending)",
            message: `${member.name} joined your organization`,
            read: false,
            createdAt:
              typeof member.createdAt === "string"
                ? member.createdAt
                : new Date(member.createdAt).toISOString(),
            severity: member.isVerified ? "success" : "info",
            link: "/org/members",
          });
        }
      } else {
        const pending = members.filter((m) => !m.isVerified);
        for (const member of pending.slice(0, 5)) {
          items.push({
            id: `org-pending-${member.id}`,
            title: "Member pending verification",
            message: `${member.name} is awaiting email verification`,
            read: false,
            createdAt: now,
            severity: "warning",
            link: "/org/members",
          });
        }
      }
    } catch {
      /* ignore */
    }

    if (prefs.notifyWeeklyReport && new Date().getDay() === 1) {
      items.push({
        id: `org-weekly-report-${weekKey()}`,
        title: "Weekly outcome report",
        message: "Your weekly outcomes summary is ready — emailed every Monday",
        read: false,
        createdAt: now,
        severity: "info",
        link: "/org/outcomes",
      });
    }

    const merged = mergeFetchedNotifications(items, existingItemsRef.current);
    merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    dispatch(
      setNotifications(
        applyPersistedReadState(orgUserId, merged, existingItemsRef.current)
      )
    );
  }, [dispatch, enabled, orgUserId]);

  useEffect(() => {
    if (!enabled) return;
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 60_000);
    return () => clearInterval(interval);
  }, [enabled, fetchAll]);

  useEffect(() => {
    if (!enabled || !orgUserId) return;

    const es = new EventSource("/api/scores/stream");

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "score_update" || !data.payload) return;
        if (!prefRef.current.notifyCrisisAlerts) return;

        const update = data.payload as ScoreUpdateEvent;
        const tier = update.risk_tier;
        if (tier !== "crisis" && tier !== "high") return;
        if (!memberIdsRef.current.has(update.member_token)) return;

        const id = `org-crisis-${update.event_id ?? update.member_token}-${update.processed_at}`;
        dispatch(
          addNotification({
            id,
            title: tier === "crisis" ? "Crisis alert" : "High-risk alert",
            message: `${update.client_name} flagged (${tier}) — immediate review recommended`,
            read: false,
            createdAt: update.processed_at ?? new Date().toISOString(),
            severity: tier === "crisis" ? "error" : "warning",
            link: "/org/dashboard",
          })
        );
      } catch {
        /* ignore */
      }
    };

    return () => es.close();
  }, [dispatch, enabled, orgUserId]);

  return { refresh: fetchAll };
}
