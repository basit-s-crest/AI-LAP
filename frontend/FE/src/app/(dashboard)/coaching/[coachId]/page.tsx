"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

const MOODS_DATA = moods.options as MoodOption[];

// ── Slot helpers ──────────────────────────────────────────────────────────────

type AvailSlot = { day: string; start: string; end: string; enabled: boolean };
type TimeSlot  = { t: string; b: boolean; assignedToOther?: boolean };

/** Parse "9:00 AM" → total minutes since midnight */
function parseTime(t: string): number {
  const [timePart, meridiem] = t.trim().split(" ");
  const [hStr, mStr] = timePart.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

/** Format total minutes since midnight → "9:00 AM" */
function formatTime(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m   = mins % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

/** Generate slot times from start → end with `duration` minute steps */
function generateSlotTimes(start: string, end: string, duration: number): string[] {
  const startMins = parseTime(start);
  const endMins   = parseTime(end);
  const times: string[] = [];
  for (let t = startMins; t + duration <= endMins; t += duration) {
    times.push(formatTime(t));
  }
  return times;
}

/** Combine today's date with a time string like "9:00 AM" → ISO string */
function todayAt(timeStr: string): string {
  const now = new Date();
  const mins = parseTime(timeStr);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
    Math.floor(mins / 60), mins % 60, 0, 0);
  return d.toISOString();
}

/** Today's day name e.g. "Monday" */
function todayDayName(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

export default function CoachingChatPage() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Dynamic slot state ──────────────────────────────────────────────────────
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [noAvailToday, setNoAvailToday] = useState(false);

  const loadSlots = useCallback(async () => {
    try {
      const [availRes, sessionsRes] = await Promise.all([
        api.get<{ slots: AvailSlot[]; duration: number }>(`/api/sessions/availability/${coachIdStr}`),
        api.get<{ date: string }[]>("/api/sessions/member"),
      ]);

      const { slots: availSlots, duration } = availRes.data;
      const memberSessions = sessionsRes.data;

      const today = todayDayName();
      const todaySlot = availSlots.find((s) => s.day === today && s.enabled);

      if (!todaySlot) {
        setNoAvailToday(true);
        setSlots([]);
        return;
      }

      setNoAvailToday(false);

      const times = generateSlotTimes(todaySlot.start, todaySlot.end, duration || 50);

      const bookedMinutes = new Set(
        memberSessions.map((s) => {
          const d = new Date(s.date);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
        })
      );

      const generated: TimeSlot[] = times.map((t) => {
        const iso = todayAt(t);
        const d = new Date(iso);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`;
        return { t, b: bookedMinutes.has(key) };
      });

      setSlots(generated);
    } catch {
      // silently keep existing slots on poll failure
    }
  }, [coachIdStr]);

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
        date: todayAt(selSlot),
      });
      setSlots((prev) => prev.map((s) => (s.t === selSlot ? { ...s, b: true } : s)));
      setBooked(true);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? "";
      if (
        msg.toLowerCase().includes("already booked") ||
        msg.toLowerCase().includes("already taken")
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    sendMessage(coachIdStr, t);
    setInput("");
  };

  const bookingCard = coach ? (
    <Card className="mb-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">Book a Session</div>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F5DDD4] text-2xl">
          {coach.avatar ?? "👤"}
        </div>
        <div>
          <div className="font-serif text-[17px] font-semibold">{coach.name}</div>
          <div className="text-xs text-mid">{coach.speciality}</div>
        </div>
      </div>
      <div className="my-4 h-px bg-line" />
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">
        Available Times — Today
      </div>
      {noAvailToday ? (
        <p className="mb-4 text-sm text-mid">Coach not available today.</p>
      ) : slots.length === 0 ? (
        <p className="mb-4 text-sm text-dim">Loading availability…</p>
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
                s.b && !s.assignedToOther && "cursor-not-allowed border-dashed bg-[#EDE7DC] text-dim",
                s.assignedToOther && "cursor-not-allowed border-dashed bg-[#F5E6E6] text-[#A0522D]"
              )}
            >
              {s.t}
              {s.b && !s.assignedToOther ? " (Booked)" : ""}
              {s.assignedToOther ? " (Already Assigned)" : ""}
            </button>
          ))}
        </div>
      )}
      {booked ? (
        <div className="flex items-center gap-2.5 rounded-[10px] bg-sage-tint px-4 py-3">
          <span className="text-lg text-sage">✓</span>
          <div>
            <div className="font-semibold">Session confirmed!</div>
            <div className="text-sm text-mid">
              {coach.name} · {selSlot}
            </div>
          </div>
        </div>
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
  ) : null;

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
        <div className="mx-auto max-w-[520px] animate-fadeIn">
          <Button variant="ghost" size="sm" className="mb-4" type="button" onClick={() => router.push("/coaching")}>
            ← Back to Coaches
          </Button>
          {bookingCard}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={coach.name}>
      <div className="animate-fadeIn">
        <Button variant="ghost" size="sm" className="mb-4" type="button" onClick={() => router.push("/coaching")}>
          ← Back to Coaches
        </Button>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <div className="flex h-[460px] flex-col overflow-hidden rounded-card border border-line">
            <div className="flex items-center gap-3 bg-sidebar px-[18px] py-3.5">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] bg-[#F5DDD4] text-[19px]">
                {coach.avatar ?? "👤"}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#FDFAF5]">{coach.name}</div>
                <div className="text-xs text-[#FDFAF5]/40">
                  <span className={cn("mr-1 inline-block h-2 w-2 rounded-full", isConnected ? "bg-[#2E7D4F]" : "bg-gray-400")} />
                  {isConnected ? "Active now" : "Connecting..."}
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-[18px]">
              {hasNextPage && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="rounded-full border border-line bg-card px-4 py-1.5 text-xs text-mid hover:bg-canvas disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading..." : "Load older messages"}
                  </button>
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
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("max-w-[72%]", m.senderRole === "member" ? "self-end" : "self-start")}
                  >
                    <div
                      className={cn(
                        "rounded-[14px] px-[15px] py-2.5 text-[13.5px] leading-relaxed",
                        m.senderRole === "member"
                          ? "rounded-br bg-sage text-white"
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
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-card px-3.5 py-3">
              <input
                className="flex-1 rounded-[22px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-canvas px-4 py-2 text-[13.5px] outline-none focus:border-sage"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <Button size="sm" type="button" onClick={send} disabled={!isConnected}>
                Send
              </Button>
            </div>
          </div>
          <div>
            {bookingCard}
            <Card>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">
                Your Mood Before Session
              </div>
              <div className="flex gap-2">
                {MOODS_DATA.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className="flex flex-1 flex-col items-center rounded-[14px] border-2 border-[rgba(60,50,40,0.12)] bg-card py-2.5 text-[22px] hover:border-[rgba(60,50,40,0.22)]"
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}