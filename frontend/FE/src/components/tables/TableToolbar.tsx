"use client";

import { cn } from "@/lib/cn";

export function TableToolbar({
  title,
  children,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b-[1.5px] border-line px-[22px] py-3.5",
        className
      )}
    >
      <h3 className="font-serif text-[17px] font-semibold text-ink">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
