"use client";

import { Button } from "@/components/ui/Button";
import type { CommunityGroup } from "@/types/group";
import { cn } from "@/lib/cn";

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
        "cursor-pointer overflow-hidden rounded-card border-[1.5px] border-line bg-card transition-all hover:-translate-y-1 hover:border-[rgba(60,50,40,0.2)] hover:shadow-soft",
        className
      )}
    >
      <div
        className="flex h-20 items-center justify-center text-[34px]"
        style={{ background: group.color }}
      >
        {group.emoji}
      </div>
      <div className="px-[18px] pb-4 pt-4">
        <div className="font-serif text-[17px] font-semibold text-ink">{group.name}</div>
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
                className="rounded-md border-[1.5px] border-[rgba(60,50,40,0.12)] bg-transparent px-2.5 py-1 text-[11.5px] font-semibold text-mid hover:border-[rgba(60,50,40,0.22)] hover:bg-[#F0EBE1] hover:text-ink"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleJoin(e);
                }}
              >
                Leave
              </button>
            ) : (
              <Button
                size="sm"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleJoin(e);
                }}
              >
                Join
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
