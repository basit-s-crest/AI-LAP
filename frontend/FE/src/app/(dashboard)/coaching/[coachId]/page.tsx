"use client";

import { useState, useEffect, useRef } from "react";
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

const MOODS_DATA = moods.options as MoodOption[];

const slots = [
  { t: "9:00 AM", b: false },
  { t: "10:30 AM", b: true },
  { t: "12:00 PM", b: false },
  { t: "2:00 PM", b: false },
  { t: "3:30 PM", b: true },
  { t: "5:00 PM", b: false },
];

export default function CoachingChatPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const bookOnly = search.get("book") === "1";

  // String coachId for the messaging hooks (Prisma CUID)
  const coachIdStr = params.coachId as string;

  const { data: coachData, isPending: coachLoading } = useCoachQuery(coachIdStr);
  const coach: CoachPublicDTO | null = coachData ?? null;

  const [input, setInput] = useState("");
  const [selSlot, setSelSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persistent message history
  const {
    messages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
    prependMessage,
  } = useCoachMessages(coachIdStr);

  // Real-time socket
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

  // Auto-scroll to bottom when new messages arrive
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
              s.b && "cursor-not-allowed border-dashed bg-[#EDE7DC] text-dim"
            )}
          >
            {s.t}
            {s.b ? " (Booked)" : ""}
          </button>
        ))}
      </div>
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
          disabled={!selSlot}
          onClick={() => setBooked(true)}
        >
          {selSlot ? `Book — ${selSlot}` : "Select a time slot"}
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
              {/* Load older messages button */}
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
              {/* Loading state */}
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
