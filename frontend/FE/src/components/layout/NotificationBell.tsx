"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notificationReadStore";
import { markAllRead, markRead } from "@/store/slices/notificationSlice";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/cn";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.auth.user?.role);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const items = useAppSelector((s) => s.notification.items);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const enabled = role === "user";
  useNotifications(enabled);

  const unreadCount = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  if (!enabled) return null;

  const handleClick = (id: string, link?: string) => {
    if (userId) markNotificationRead(userId, id);
    dispatch(markRead(id));
    setOpen(false);
    if (link) router.push(link);
  };

  const handleMarkAllRead = () => {
    if (userId) markAllNotificationsRead(userId, items.map((n) => n.id));
    dispatch(markAllRead());
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink transition-colors hover:bg-[#EDE7DC]"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-terra px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[200] mt-2 w-[min(100vw-2rem,360px)] overflow-hidden rounded-card border border-line bg-card shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {items.length > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-sage hover:underline"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[min(70vh,400px)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-dim">No notifications</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n.id, n.link)}
                  className={cn(
                    "flex w-full gap-3 border-b border-[rgba(60,50,40,0.06)] px-4 py-3 text-left transition-colors hover:bg-[#EDE7DC]",
                    !n.read && "bg-sage-soft/40"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-ink">{n.title}</div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-mid">{n.message}</p>
                    <p className="mt-1 text-[10px] text-dim">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-terra" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
