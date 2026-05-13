"use client";

import { Button } from "@/components/ui/Button";
import type { CoachPublicDTO } from "@/types/coach";
import { cn } from "@/lib/cn";

export function CoachCard({
  coach,
  onMessage,
  onBook,
  disabled,
  className,
}: {
  coach: CoachPublicDTO;
  onMessage?: () => void;
  onBook?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-3 flex cursor-pointer gap-3.5 rounded-card border-[1.5px] border-line bg-card p-5 transition-all hover:border-[rgba(60,50,40,0.2)] hover:shadow-soft",
        className
      )}
    >
      <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-xl bg-[#F5DDD4] text-2xl">
        {coach.avatar ?? "👤"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-[17px] font-semibold text-ink">{coach.name}</div>
        {coach.speciality ? (
          <div className="my-1 text-xs text-mid">{coach.speciality}</div>
        ) : null}
        {coach.bio ? (
          <div className="text-xs text-dim">{coach.bio}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2 self-center">
        {onMessage ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onMessage}
            disabled={disabled}
          >
            {disabled ? "Connecting…" : "Message"}
          </Button>
        ) : null}
        {onBook ? (
          <Button size="sm" type="button" onClick={onBook} disabled={disabled}>
            Book
          </Button>
        ) : null}
      </div>
    </div>
  );
}
