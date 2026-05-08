"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumbs } from "./Breadcrumbs";

export function Topbar({
  title,
  breadcrumbs,
  right,
  onMenu,
}: {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  right?: React.ReactNode;
  onMenu?: () => void;
}) {
  return (
    <header className="sticky top-0 z-[100] flex h-[58px] items-center justify-between border-b-[1.5px] border-line bg-card px-4 shadow-topbar md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="md:hidden"
          aria-label="Open menu"
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-serif text-[22px] font-semibold text-ink">{title}</h1>
          {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mt-0.5 hidden sm:flex" /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </header>
  );
}
