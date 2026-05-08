"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Coach } from "@/types/coach";
import { cn } from "@/lib/cn";

export function CoachCard({
  coach,
  onMessage,
  onBook,
  className,
}: {
  coach: Coach;
  onMessage?: () => void;
  onBook?: () => void;
  className?: string;
}) {
  const availColor =
    coach.avail === "available"
      ? "#2E7D4F"
      : coach.avail === "busy"
        ? "#B8832A"
        : "#9C9188";
  const dot =
    coach.avail === "available"
      ? "bg-[#2E7D4F]"
      : coach.avail === "busy"
        ? "bg-gold"
        : "bg-dim";

  return (
    <div
      className={cn(
        "mb-3 flex cursor-pointer gap-3.5 rounded-card border-[1.5px] border-line bg-card p-5 transition-all hover:border-[rgba(60,50,40,0.2)] hover:shadow-soft",
        className
      )}
    >
      <div
        className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{ background: coach.bg }}
      >
        {coach.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[17px] font-semibold text-ink">{coach.name}</div>
        <div className="my-1 text-xs text-mid">{coach.spec}</div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold" style={{ color: availColor }}>
            <span className={cn("mr-1 inline-block h-2 w-2 rounded-full", dot)} />
            {coach.avail === "available"
              ? "Available now"
              : coach.avail === "busy"
                ? "In session"
                : "Offline"}
          </span>
          {coach.rating != null ? (
            <span className="text-xs text-dim">
              ⭐ {coach.rating} · {coach.sessions} sessions
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 self-center">
        {onMessage ? (
          <Button variant="outline" size="sm" type="button" onClick={onMessage}>
            Message
          </Button>
        ) : null}
        {onBook ? (
          <Button size="sm" type="button" onClick={onBook}>
            Book
          </Button>
        ) : null}
      </div>
    </div>
  );
}
