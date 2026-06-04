"use client";
import { Button } from "@/components/ui/Button";
import type { CommunityGroup } from "@/types/group";
import { cn } from "@/lib/cn";

// Fixed calm palette — cycles based on group id
const BAND_COLORS = [
  "#D4EDD7", // sage green
  "#C8DFF5", // sky blue
  "#F5DDD4", // warm peach
  "#E8D5F0", // soft lavender
  "#F5E6C8", // warm gold
  "#D4EAE8", // teal mint
  "#F0D4D4", // soft rose
  "#D4E8D4", // light green
];

function getBandColor(id: string): string {
  // Sum char codes of id to pick a color — deterministic, never changes
  const sum = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return BAND_COLORS[sum % BAND_COLORS.length];
}

export function GroupCard({
  group,
  onOpen,
  onToggleJoin,
  className,
}: {
  group: CommunityGroup;
  onOpen?: () => void;
  onToggleJoin?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={cn(
        "cursor-pointer overflow-hidden rounded-card border border-line bg-card transition-all hover:-translate-y-1 hover:border-[var(--border-mid)] hover:shadow-soft",
        className
      )}
    >
      <div
        className="flex h-20 items-center justify-center text-[34px]"
        style={{ background: getBandColor(group.id) }}
      >
        {group.emoji}
      </div>
      <div className="px-[18px] pb-4 pt-4">
        <div className="serif text-[17px] text-ink">{group.name}</div>
        <p className="mb-3 mt-1 text-xs leading-relaxed text-mid">{group.desc}</p>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-dim">
            {group.members} members
            {group.posts ? ` · ${group.posts} posts` : ""}
          </div>
          {onToggleJoin ? (
            group.joined ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ padding: "6px 14px", fontSize: "11.5px", borderColor: "var(--sage)", color: "var(--sage)", fontWeight: 700 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleJoin(e);
                }}
              >
                Leave
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ padding: "6px 14px", fontSize: "11.5px", fontWeight: 700 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleJoin(e);
                }}
              >
                Join
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}