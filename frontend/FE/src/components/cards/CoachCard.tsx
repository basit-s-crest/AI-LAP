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
    <div className={cn("coach-card", className)}>
      <div className="coach-avt">
        {coach.avatar ?? "👤"}
      </div>
      <div className="coach-name">{coach.name}</div>
      <div className="coach-spec">{coach.speciality ?? "Counselor"}</div>
      
      <div className="flex gap-2 w-full mt-auto">
        {onMessage ? (
          <button
            type="button"
            className="btn btn-outline btn-sm w-full"
            style={{ padding: "10px 0", fontSize: "12.5px", borderColor: "var(--sage)", color: "var(--sage)", fontWeight: 700 }}
            onClick={onMessage}
            disabled={disabled}
          >
            {disabled ? "Connecting…" : "💬 Message"}
          </button>
        ) : null}
        {onBook ? (
          <button
            type="button"
            className="btn btn-primary btn-sm w-full"
            style={{ padding: "10px 0", fontSize: "12.5px", fontWeight: 700 }}
            onClick={onBook}
            disabled={disabled}
          >
            📅 Book
          </button>
        ) : null}
      </div>
    </div>
  );
}
