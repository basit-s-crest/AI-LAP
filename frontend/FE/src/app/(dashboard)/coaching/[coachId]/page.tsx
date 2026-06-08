"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCoachQuery } from "@/hooks/api/use-coaches";
import { useCoachMessages } from "@/hooks/useCoachMessages";
import { useCoachSocket } from "@/hooks/useCoachSocket";
import type { CoachPublicDTO } from "@/types/coach";
import type { CoachMessageDTO } from "@/types/coachMessage";
import moods from "@/mock/moods.json";
import type { MoodOption } from "@/types/mood";
import { cn } from "@/lib/cn";
import api from "@/lib/api";
import { AUTH_USER_JSON_KEY } from "@/constants/storage";

const MOODS_DATA = moods.options as MoodOption[];

// ── Slot helpers ──────────────────────────────────────────────────────────────

type AvailSlot = { day: string; start: string; end: string; enabled: boolean };
type TimeSlot = { t: string; b: boolean; assignedToOther?: boolean; isMySession?: boolean };

function parseTime(t: string): number {
  const [timePart, meridiem] = t.trim().split(" ");
  const [hStr, mStr] = timePart.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function formatTime(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m   = mins % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

function generateSlotTimes(start: string, end: string, duration: number): string[] {
  const startMins = parseTime(start);
  const endMins   = parseTime(end);
  const times: string[] = [];
  for (let t = startMins; t + duration <= endMins; t += duration) {
    times.push(formatTime(t));
  }
  return times;
}

function todayAt(timeStr: string): string {
  const now = new Date();
  const mins = parseTime(timeStr);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
    Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toISOString();
}

function todayDayName(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function utcSlotInstantKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
}

function isScheduledAtLocalCalendarToday(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

const RESCHEDULE_HORIZON_DAYS = 7;

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayNameLongLocal(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function listCoachAvailableDates(availSlots: AvailSlot[], from: Date, horizonDays: number): { ymd: string; label: string }[] {
  const enabled = new Set(availSlots.filter((s) => s.enabled).map((s) => s.day));
  if (enabled.size === 0) return [];
  const out: { ymd: string; label: string }[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  const end = new Date(cursor);
  end.setDate(end.getDate() + horizonDays);
  while (cursor < end) {
    if (enabled.has(dayNameLongLocal(cursor))) {
      const ymd = formatYmdLocal(cursor);
      const label = cursor.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      out.push({ ymd, label });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function getTimesForYmd(ymd: string, availSlots: AvailSlot[], duration: number): string[] {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !mo || !d) return [];
  const dayDate = new Date(y, mo - 1, d, 12, 0, 0, 0);
  const dayName = dayNameLongLocal(dayDate);
  const slot = availSlots.find((s) => s.day === dayName && s.enabled);
  if (!slot) return [];
  return generateSlotTimes(slot.start, slot.end, duration || 50);
}

function dateTimeOnCalendarDay(ymd: string, timeStr: string): Date {
  const [y, mo, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const mins = parseTime(timeStr);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0, 0);
}

function filterTimesAfterNowIfToday(ymd: string, times: string[], now: Date): string[] {
  if (ymd !== formatYmdLocal(now)) return times;
  const t0 = now.getTime();
  return times.filter((t) => dateTimeOnCalendarDay(ymd, t).getTime() > t0);
}

function listRescheduleDateOptions(
  availSlots: AvailSlot[],
  duration: number,
  from: Date,
  horizonDays: number
): { ymd: string; label: string }[] {
  const raw = listCoachAvailableDates(availSlots, from, horizonDays);
  const now = new Date();
  return raw.filter((o) => {
    const times = getTimesForYmd(o.ymd, availSlots, duration);
    return filterTimesAfterNowIfToday(o.ymd, times, now).length > 0;
  });
}

// ── Date separator helpers ────────────────────────────────────────────────────
function getDayKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CoachingChatPage() {
  // ── Refs ── MUST be inside the component
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const bookOnly = search.get("book") === "1";

  const coachIdStr = params.coachId as string;

  const { data: coachData, isPending: coachLoading } = useCoachQuery(coachIdStr);
  const coach: CoachPublicDTO | null = coachData ?? null;

  const [input, setInput] = useState("");
  const [selSlot, setSelSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const [booking, setBooking] = useState(false);
  const [currentSession, setCurrentSession] = useState<{ id: string; scheduledAt: string; status: string; livekitStartedAt?: string } | null>(null);

  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "book">("chat");
  const [selectedDate, setSelectedDate] = useState<string>(formatYmdLocal(new Date()));

  // ── Dynamic slot state ──────────────────────────────────────────────────────
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [noAvailToday, setNoAvailToday] = useState(false);
  const [availabilityTemplate, setAvailabilityTemplate] = useState<AvailSlot[]>([]);
  const [availabilityDuration, setAvailabilityDuration] = useState(50);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!showReschedule) return;
    const allowed = listRescheduleDateOptions(
      availabilityTemplate,
      availabilityDuration,
      new Date(),
      RESCHEDULE_HORIZON_DAYS
    );
    if (allowed.length === 0) {
      setRescheduleDate("");
      setRescheduleTime("");
      return;
    }
    setRescheduleDate((prev) =>
      allowed.some((x) => x.ymd === prev) ? prev : allowed[0].ymd
    );
  }, [showReschedule, availabilityTemplate, availabilityDuration]);

  useEffect(() => {
    if (!showReschedule || !rescheduleDate) return;
    const now = new Date();
    const raw = getTimesForYmd(rescheduleDate, availabilityTemplate, availabilityDuration);
    const times = filterTimesAfterNowIfToday(rescheduleDate, raw, now);
    if (times.length === 0) {
      setRescheduleTime("");
      return;
    }
    setRescheduleTime((prev) => (times.includes(prev) ? prev : times[0]));
  }, [showReschedule, rescheduleDate, availabilityTemplate, availabilityDuration]);

  const syncMyBookingState = useCallback(
    async (generated: TimeSlot[], targetYmd: string) => {
      const mine = generated.find((x) => x.isMySession);
      if (mine) {
        setBooked(true);
        setSelSlot(mine.t);
      }
      const [y, mo, d] = targetYmd.split("-").map(Number);
      const targetDate = new Date(y, mo - 1, d, 12, 0, 0, 0);
      try {
        const res = await api.get<
          { id: string; coachId: string; scheduledAt: string; status: string; livekitStartedAt?: string }[]
        >("/api/sessions/member");
        const sess = res.data.find(
          (s) =>
            s.coachId === coachIdStr &&
            s.status !== "cancelled" &&
            isScheduledAtLocalCalendarToday(s.scheduledAt, targetDate)
        );
        if (sess) {
          if (!isScheduledAtLocalCalendarToday(sess.scheduledAt, targetDate)) {
            setBooked(false);
            setSelSlot(null);
            setCurrentSession(null);
          } else {
            const d = new Date(sess.scheduledAt);
            const mins = d.getHours() * 60 + d.getMinutes();
            setBooked(true);
            setSelSlot(formatTime(mins));
            setCurrentSession(sess);
          }
        } else {
          setBooked(false);
          setSelSlot(null);
          setCurrentSession(null);
        }
      } catch {
        setBooked(false);
        setSelSlot(null);
        setCurrentSession(null);
      }
    },
    [coachIdStr]
  );

  const loadSlots = useCallback(async () => {
    try {
      const availRes = await api.get<{
        slots: AvailSlot[];
        duration: number;
        bookedToday?: { date: string; memberId: string }[];
      }>(`/api/sessions/availability/${coachIdStr}?date=${selectedDate}`);

      const { slots: availSlots, duration, bookedToday = [] } = availRes.data;

      setAvailabilityTemplate(availSlots);
      setAvailabilityDuration(duration ?? 50);

      function getMemberIdFromCookie(): string | null {
        if (typeof document === "undefined") return null;
        try {
          const encoded = encodeURIComponent(AUTH_USER_JSON_KEY);
          const match = document.cookie.split("; ").find((r) => r.startsWith(`${encoded}=`));
          if (!match) return null;
          const raw = decodeURIComponent(match.split("=")[1]);
          const user = JSON.parse(raw) as { id?: string };
          return user.id ?? null;
        } catch {
          return null;
        }
      }
      const myMemberId = getMemberIdFromCookie();

      const [y, mo, d] = selectedDate.split("-").map(Number);
      const targetDate = new Date(y, mo - 1, d, 12, 0, 0, 0);
      const dayName = targetDate.toLocaleDateString("en-US", { weekday: "long" });
      const slot = availSlots.find((s) => s.day === dayName && s.enabled);

      if (!slot) {
        setNoAvailToday(true);
        setSlots([]);
        await syncMyBookingState([], selectedDate);
        return;
      }

      setNoAvailToday(false);

      const times = generateSlotTimes(slot.start, slot.end, duration || 50);
      const now = new Date();
      const filteredTimes = filterTimesAfterNowIfToday(selectedDate, times, now);

      const bookedMap = new Map<string, string>();
      bookedToday.forEach((b: { date: string; memberId: string }) => {
        const key = utcSlotInstantKey(b.date);
        if (key) bookedMap.set(key, b.memberId);
      });

      const generated: TimeSlot[] = filteredTimes.map((t) => {
        const iso = dateTimeOnCalendarDay(selectedDate, t).toISOString();
        const key = utcSlotInstantKey(iso);
        const bookedById = key ? bookedMap.get(key) : undefined;
        const isBooked = !!bookedById;
        const isMySession = bookedById === myMemberId;
        return { t, b: isBooked, assignedToOther: isBooked && !isMySession, isMySession };
      });

      setSlots(generated);
      await syncMyBookingState(generated, selectedDate);
    } catch {
      // silently keep existing slots on poll failure
    }
  }, [coachIdStr, selectedDate, syncMyBookingState]);

  useEffect(() => {
    loadSlots();
    const interval = setInterval(loadSlots, 30_000);
    return () => clearInterval(interval);
  }, [loadSlots]);

  // ── Book handler ────────────────────────────────────────────────────────────
  const handleBook = async () => {
    if (!selSlot || booking) return;
    setBooking(true);
    try {
      await api.post("/api/sessions/book", {
        coachId: coachIdStr,
        date: dateTimeOnCalendarDay(selectedDate, selSlot).toISOString(),
      });
      await loadSlots();
      setBooked(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = axiosErr?.response?.data?.message ?? axiosErr?.message ?? "";
      if (
        msg.toLowerCase().includes("already booked") ||
        msg.toLowerCase().includes("already taken") ||
        msg.toLowerCase().includes("session at this time")
      ) {
        setSlots((prev) =>
          prev.map((s) =>
            s.t === selSlot ? { ...s, b: true, assignedToOther: true } : s
          )
        );
        setSelSlot(null);
      } else {
        toast.error(msg || "Failed to book session");
      }
    } finally {
      setBooking(false);
    }
  };

  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
    prependMessage,
  } = useCoachMessages(coachIdStr);

  const { sendMessage, isConnected } = useCoachSocket({
    onNewMessage: (msg: CoachMessageDTO) => {
      prependMessage(msg);
    },
    onError: (err: { code: string; message: string }) => {
      if (err.code === "SAVE_FAILED") {
        toast.error("Message failed to send. Please try again.");
      } else if (err.code === "UNAUTHORIZED_THREAD") {
        toast.error("You are not authorized to message this coach.");
      }
    },
  });

  // ── Scroll: instant on initial load, smooth for new socket messages ──────────
const prevCoachId = useRef<string | null>(null);

useEffect(() => {
  if (!messagesEndRef.current || messages.length === 0) return;
  const coachChanged = prevCoachId.current !== coachIdStr;
  prevCoachId.current = coachIdStr;
  if (coachChanged) {
    messagesEndRef.current.scrollIntoView({ behavior: "instant" });
  } else {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }
}, [messages, coachIdStr]);

  // Load older messages when user scrolls to top
  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    if (el.scrollTop < 60 && hasNextPage && !isFetchingNextPage) {
      const prevScrollHeight = el.scrollHeight;
      fetchNextPage();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    sendMessage(coachIdStr, t);
    setInput("");
  };

  const renderRescheduleModal = () => {
    if (!portalReady || !showReschedule) return null;
    const now = new Date();
    const allowedDates = listRescheduleDateOptions(
      availabilityTemplate,
      availabilityDuration,
      now,
      RESCHEDULE_HORIZON_DAYS
    );
    const timeChoices = rescheduleDate
      ? filterTimesAfterNowIfToday(
          rescheduleDate,
          getTimesForYmd(rescheduleDate, availabilityTemplate, availabilityDuration),
          now
        )
      : [];

    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-reschedule-title"
      >
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 id="member-reschedule-title" className="font-serif text-lg font-semibold">
              Reschedule Session
            </h3>
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              className="text-dim hover:text-ink"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            {allowedDates.length === 0 ? (
              <p className="text-sm text-mid">
                Your coach has no upcoming bookable days in their weekly schedule. Ask them to set
                availability in the portal.
              </p>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-dim">
                    New Date
                  </label>
                  <select
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] outline-none focus:border-sage"
                  >
                    {allowedDates.map((opt) => (
                      <option key={opt.ymd} value={opt.ymd}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-dim">
                    New Time
                  </label>
                  <select
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    disabled={timeChoices.length === 0}
                    className="w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] outline-none focus:border-sage disabled:opacity-50"
                  >
                    {timeChoices.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowReschedule(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={
                rescheduleLoading ||
                allowedDates.length === 0 ||
                !rescheduleDate ||
                !rescheduleTime ||
                timeChoices.length === 0
              }
              onClick={async () => {
                setRescheduleLoading(true);
                try {
                  const newDate = dateTimeOnCalendarDay(rescheduleDate, rescheduleTime);
                  if (!(newDate.getTime() > Date.now())) {
                    toast.error("Pick a time in the future");
                    return;
                  }
                  const newScheduledAt = newDate.toISOString();
                  const sessionsRes = await api.get<
                    { id: string; coachId: string; scheduledAt: string; status: string }[]
                  >("/api/sessions/member");
                  const nowRef = new Date();
                  const mySession = sessionsRes.data.find(
                    (s) =>
                      s.coachId === coachIdStr &&
                      s.status !== "cancelled" &&
                      isScheduledAtLocalCalendarToday(s.scheduledAt, nowRef)
                  );
                  if (!mySession) {
                    toast.error("Session not found");
                    return;
                  }
                  await api.patch(
                    `/api/sessions/${mySession.id}/reschedule`,
                    { newScheduledAt }
                  );
                  setShowReschedule(false);
                  setBooked(false);
                  setSelSlot(null);
                  setCurrentSession(null);
                  await loadSlots();
                  toast.success("Session rescheduled");
                } catch (err: unknown) {
                  const axiosErr = err as {
                    response?: { data?: { message?: string } };
                  };
                  toast.error(
                    axiosErr?.response?.data?.message ?? "Failed to reschedule"
                  );
                } finally {
                  setRescheduleLoading(false);
                }
              }}
            >
              {rescheduleLoading ? "Saving…" : "Confirm Reschedule"}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderCancelConfirmModal = () => {
    if (!portalReady || !showCancelConfirm || !coach) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-cancel-title"
      >
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 id="member-cancel-title" className="font-serif text-lg font-semibold">
              Cancel Session?
            </h3>
            <button
              type="button"
              onClick={() => setShowCancelConfirm(false)}
              className="text-dim hover:text-ink"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-mid">
            Are you sure you want to cancel your session with {coach.name}?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowCancelConfirm(false)}
            >
              Keep Session
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={cancelLoading}
              onClick={async () => {
                setCancelLoading(true);
                try {
                  const res = await api.get<
                    { id: string; coachId: string; scheduledAt: string; status: string }[]
                  >("/api/sessions/member");
                  const mySession = res.data.find(
                    (s) =>
                      s.coachId === coachIdStr &&
                      s.status !== "cancelled" &&
                      new Date(s.scheduledAt).toTimeString().startsWith(
                        new Date(todayAt(selSlot ?? "")).toTimeString().slice(0, 5)
                      )
                  );
                  if (!mySession) return;
                  await api.patch(`/api/sessions/${mySession.id}/cancel`);
                  setBooked(false);
                  setSelSlot(null);
                  setCurrentSession(null);
                  await loadSlots();
                } catch (err: unknown) {
                  const axiosErr = err as { response?: { data?: { message?: string } } };
                  toast.error(axiosErr?.response?.data?.message ?? "Failed to cancel");
                } finally {
                  setCancelLoading(false);
                  setShowCancelConfirm(false);
                }
              }}
            >
              {cancelLoading ? "Cancelling…" : "Yes, Cancel"}
            </Button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const bookingCard = coach ? (() => {
    const myBookedTimeLabel =
      selSlot ?? slots.find((s) => s.isMySession)?.t ?? null;
    const showOnlyMyBookedSlot = Boolean(booked && myBookedTimeLabel);

    return (
    <Card className="mb-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">Book a Session</div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--bg-surface-2)] border border-line text-2xl">
          {coach.avatar ?? "👤"}
        </div>
        <div>
          <div className="font-serif text-[17px] font-semibold">{coach.name}</div>
          <div className="text-xs text-mid">{coach.speciality}</div>
        </div>
      </div>
      <div className="my-4 h-px bg-line" />
      <div className="mb-4">
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-dim">
          Select Date
        </label>
        <select
          value={selectedDate}
          onChange={(e) => {
            setSelectedDate(e.target.value);
            setSelSlot(null);
            setBooked(false);
          }}
          className="w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-sage"
        >
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return {
              ymd: formatYmdLocal(d),
              label: d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              }),
            };
          }).map((d) => (
            <option key={d.ymd} value={d.ymd}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">
        Available Times — {formatDateLabel(selectedDate.replace(/-/g, "/"))}
      </div>
      {noAvailToday ? (
        <p className="mb-4 text-sm text-mid">Coach not available on this date.</p>
      ) : slots.length === 0 ? (
        <p className="mb-4 text-sm text-dim">Loading availability…</p>
      ) : showOnlyMyBookedSlot && myBookedTimeLabel ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div
            role="status"
            className="col-span-2 cursor-default rounded-lg border-[1.5px] border-sage bg-sage-tint py-2 text-center text-[13px] font-semibold text-sage"
          >
            {myBookedTimeLabel}
            <span> ✓ Your Session</span>
          </div>
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-2">
          {slots.map((s) => (
            <button
              key={`${s.t}-${s.b ? "booked" : "free"}`}
              type="button"
              disabled={s.b}
              onClick={() => !s.b && setSelSlot(s.t)}
              className={cn(
                "rounded-lg border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card py-2 text-center text-[13px] font-semibold text-ink transition-colors",
                !s.b && "hover:border-sage hover:bg-sage-soft",
                selSlot === s.t && "border-sage bg-sage-tint text-sage",
                s.isMySession && "cursor-not-allowed border-sage bg-sage-tint text-sage",
                s.b && !s.assignedToOther && !s.isMySession && "cursor-not-allowed border-dashed bg-[var(--bg-surface-2)] text-dim",
                s.assignedToOther && "cursor-not-allowed border-dashed bg-danger-soft text-danger"
              )}
            >
              {s.t}
              {s.isMySession ? " ✓ Your Session" : ""}
              {s.b && !s.isMySession ? " · Taken" : ""}
            </button>
          ))}
        </div>
      )}
      {booked ? (
        <>
          <div className="flex items-center gap-2.5 rounded-[10px] bg-sage-tint px-4 py-3">
            <span className="text-lg text-sage">✓</span>
            <div>
              <div className="font-semibold">Session confirmed!</div>
              <div className="text-sm text-mid">
                {coach.name} · {myBookedTimeLabel ?? selSlot}
              </div>
            </div>
          </div>
          {currentSession && (
            <Button
              className="mt-3 animate-pulse"
              fullWidth
              variant="primary"
              onClick={() => router.push(`/coaching/sessions/${currentSession.id}/call`)}
            >
              Join Meeting
            </Button>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              fullWidth
              title="Pick a new date and time (opens popup)"
              onClick={() => {
                setShowReschedule(true);
              }}
            >
              Reschedule
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              fullWidth
              onClick={() => setShowCancelConfirm(true)}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          fullWidth
          type="button"
          disabled={!selSlot || booking}
          onClick={handleBook}
        >
          {booking ? "Booking…" : selSlot ? `Book — ${selSlot}` : "Select a time slot"}
        </Button>
      )}
    </Card>
    );
  })() : null;

  if (coachLoading) {
    return (
      <DashboardLayout title="Coaching">
        <p className="text-mid">Loading…</p>
      </DashboardLayout>
    );
  }

  if (!coach) {
    return (
      <DashboardLayout title="Coaching">
        <p className="text-mid">Coach not found.</p>
      </DashboardLayout>
    );
  }

  if (bookOnly) {
    return (
      <DashboardLayout title="Book session">
        <div className="mx-auto max-w-[520px] anim-up">
          <Button variant="ghost" size="sm" className="mb-4" type="button" onClick={() => router.push("/coaching")}>
            ← Back to Coaches
          </Button>
          {bookingCard}
          {renderRescheduleModal()}
          {renderCancelConfirmModal()}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={coach.name}>
      <div className="anim-up">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: "8px 18px", fontSize: "13px" }}
            onClick={() => router.push("/coaching")}
          >
            ← Back to Coaches
          </button>
          
          <div className="flex gap-1 rounded-[10px] bg-[var(--bg-surface-2)] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={cn(
                "rounded-[7px] px-[18px] py-[7px] text-[13px] font-semibold outline-none transition-all",
                activeTab === "chat"
                  ? "bg-card text-ink shadow-[0_1px_4px_rgba(60,50,40,0.1)]"
                  : "text-mid hover:text-ink"
              )}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("book")}
              className={cn(
                "rounded-[7px] px-[18px] py-[7px] text-[13px] font-semibold outline-none transition-all",
                activeTab === "book"
                  ? "bg-card text-ink shadow-[0_1px_4px_rgba(60,50,40,0.1)]"
                  : "text-mid hover:text-ink"
              )}
            >
              Book a Session
            </button>
          </div>
        </div>

        {booked && currentSession && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl bg-sage-soft border border-[var(--sage)] p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xl">🤝</span>
              <div>
                <h4 className="font-semibold text-ink">Your call is ready!</h4>
                <p className="text-xs text-mid">
                  You have a scheduled session with {coach.name} today.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              className="animate-pulse"
              onClick={() => router.push(`/coaching/sessions/${currentSession.id}/call`)}
            >
              Join Meeting
            </Button>
          </div>
        )}

        {activeTab === "chat" ? (
          <div className="mx-auto max-w-3xl w-full flex h-[580px] flex-col overflow-hidden rounded-card border border-line shadow-sm">
            <div className="flex items-center gap-3 border-b border-line bg-[var(--bg-surface-2)] px-[18px] py-3.5">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-card border border-line text-[19px]">
                {coach.avatar ?? "👤"}
              </div>
              <div>
                <div className="text-sm font-bold text-ink">{coach.name}</div>
                <div className="text-xs text-soft flex items-center gap-1.5">
                  <span className={cn("inline-block h-2 w-2 rounded-full", isConnected ? "bg-[var(--sage)]" : "bg-gray-400")} />
                  {isConnected ? "Active now" : "Connecting..."}
                </div>
              </div>
            </div>
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[var(--bg-surface-2)] p-[18px]"
            >
              {isFetchingNextPage && (
                <div className="flex justify-center py-2">
                  <p className="text-xs text-dim">Loading older messages...</p>
                </div>
              )}
              {messagesLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-dim">Loading messages…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-dim">Start the conversation!</p>
                </div>
              ) : (
                messages.flatMap((m, i) => {
                  const showSeparator =
                    i === 0 || getDayKey(m.createdAt) !== getDayKey(messages[i - 1].createdAt);
                  return [
                    showSeparator && (
                      <div key={`sep-${m.id}`} className="my-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-line" />
                        <span className="px-2 text-[11px] font-medium text-dim">
                          {formatDateLabel(m.createdAt)}
                        </span>
                        <div className="h-px flex-1 bg-line" />
                      </div>
                    ),
                    <div
                      key={m.id}
                      className={cn("max-w-[72%]", m.senderRole === "member" ? "self-end" : "self-start")}
                    >
                      <div
                        className={cn(
                          "rounded-[14px] px-[15px] py-2.5 text-[13.5px] leading-relaxed",
                          m.senderRole === "member"
                            ? "rounded-br bg-[var(--sage)] text-white"
                            : "rounded-bl border border-line bg-card text-ink shadow-[0_2px_6px_rgba(60,50,40,0.07)]"
                        )}
                      >
                        {m.content}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 text-[10px] text-dim",
                          m.senderRole === "member" && "text-right"
                        )}
                      >
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>,
                  ].filter(Boolean);
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex items-center gap-2.5 border-t border-line bg-card px-4 py-3">
              <input
                className="flex-1 rounded-[12px] border border-[var(--border-mid)] bg-[var(--bg-surface-2)] px-4 py-2 text-[13.5px] outline-none focus:border-sage text-ink"
                placeholder={`Type a message to ${coach.name.split(" ")[1] || coach.name}…`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={send}
                disabled={!isConnected}
                style={{ borderRadius: "var(--r-sm)", padding: "8px 18px", fontSize: "13px" }}
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-[520px] w-full">
            {bookingCard}
          </div>
        )}
        {renderRescheduleModal()}
        {renderCancelConfirmModal()}
      </div>
    </DashboardLayout>
  );
}
