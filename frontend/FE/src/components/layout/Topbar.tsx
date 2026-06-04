"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "./Breadcrumbs";
import { NotificationBell } from "./NotificationBell";

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
    <header className="topbar">
      <div className="topbar-left">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="md:hidden p-1 mr-1 text-[#5C6B73] hover:text-[#1E252B]"
          aria-label="Open menu"
          onClick={onMenu}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="topbar-title">{title}</div>
        {breadcrumbs?.length ? (
          <span className="topbar-sub font-semibold">
            {breadcrumbs[breadcrumbs.length - 1].label}
          </span>
        ) : null}
      </div>
      <div className="topbar-right">
        <NotificationBell />
        {right}
      </div>
    </header>
  );
}
