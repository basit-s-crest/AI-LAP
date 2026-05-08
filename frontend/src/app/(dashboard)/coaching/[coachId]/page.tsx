"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCoachQuery } from "@/hooks/api/use-coaches";
import type { Coach } from "@/types/coach";
import moods from "@/mock/moods.json";
import type { MoodOption } from "@/types/mood";
import { cn } from "@/lib/cn";

const MOODS_DATA = moods.options as MoodOption[];

const initialMsgs = [
  { role: "coach" as const, text: "Hi! So glad you reached out. How have you been feeling since our last session?", time: "2:01 PM" },
  { role: "user" as const, text: "A bit better honestly. The breathing exercises have been helping.", time: "2:02 PM" },
  { role: "coach" as const, text: "That's wonderful 🌿 Consistency really does make a difference. What's been triggering you most?", time: "2:03 PM" },
];

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
  const coachId = Number(params.coachId);
  const { data: coachData, isPending: coachLoading } = useCoachQuery(coachId);
  const coach: Coach | null = coachData ?? null;
  const [msgs, setMsgs] = useState(initialMsgs);
  const [input, setInput] = useState("");
  const [selSlot, setSelSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  const send = () => {
    const t = input.trim();
    if (!t) return;
    setMsgs((m) => [...m, { role: "user", text: t, time: "Now" }]);
    setInput("");
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "coach",
          text: "Thank you for sharing that. Let's explore this more in our next session together.",
          time: "Now",
        },
      ]);
    }, 1200);
  };

  const bookingCard = coach ? (
    <Card className="mb-4">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">Book a Session</div>
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl"
          style={{ background: coach.bg }}
        >
          {coach.emoji}
        </div>
        <div>
          <div className="font-serif text-[17px] font-semibold">{coach.name}</div>
          <div className="text-xs text-mid">{coach.spec}</div>
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
              <div
                className="flex h-[38px] w-[38px] items-center justify-center rounded-[9px] text-[19px]"
                style={{ background: coach.bg }}
              >
                {coach.emoji}
              </div>
              <div>
                <div className="text-sm font-semibold text-[#FDFAF5]">{coach.name}</div>
                <div className="text-xs text-[#FDFAF5]/40">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#2E7D4F]" />
                  Active now
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-canvas p-[18px]">
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={cn("max-w-[72%]", m.role === "user" ? "self-end" : "self-start")}
                >
                  <div
                    className={cn(
                      "rounded-[14px] px-[15px] py-2.5 text-[13.5px] leading-relaxed",
                      m.role === "user"
                        ? "rounded-br bg-sage text-white"
                        : "rounded-bl border border-line bg-card text-ink shadow-[0_2px_6px_rgba(60,50,40,0.07)]"
                    )}
                  >
                    {m.text}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-[10px] text-dim",
                      m.role === "user" && "text-right"
                    )}
                  >
                    {m.time}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-line bg-card px-3.5 py-3">
              <input
                className="flex-1 rounded-[22px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-canvas px-4 py-2 text-[13.5px] outline-none focus:border-sage"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <Button size="sm" type="button" onClick={send}>
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
