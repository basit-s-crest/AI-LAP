"use client";

import { Menu, LogOut, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Breadcrumbs } from "./Breadcrumbs";
import { NotificationBell } from "./NotificationBell";
import { useLogout } from "@/hooks/auth/useLogout";
import { useAppSelector } from "@/hooks/redux";
import { roleSidebarLabel } from "@/constants/navigation";
import { useRouter } from "next/navigation";

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
  const logout = useLogout();
  const router = useRouter();

  const reduxUser = useAppSelector((s) => s.auth.user);
  const role = reduxUser?.role;
  const userName = reduxUser
    ? `${reduxUser.firstName} ${reduxUser.lastName}`.trim() || "Member"
    : undefined;
  const label = role ? roleSidebarLabel(role) : "";

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

        {userName && (
          <>
            <div className="h-6 w-px bg-line mx-1" />
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white shadow-sm shrink-0"
                style={{
                  fontSize: "14px",
                  background:
                    role === "coach"
                      ? "var(--teal)"
                      : role === "superadmin" || role === "organization"
                      ? "var(--amber)"
                      : "var(--sage)",
                }}
                title={label}
              >
                {userName[0]?.toUpperCase() || "U"}
              </div>
              
              <div className="hidden md:flex flex-col text-left mr-1">
                <span className="text-[13px] font-semibold text-ink leading-tight">{userName}</span>
                <span className="text-[10px] font-medium text-soft uppercase tracking-wider mt-0.5">
                  {label}
                </span>
              </div>

              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-soft transition-colors hover:bg-[var(--bg-surface-2)] hover:text-ink"
                onClick={() => router.push("/")}
                title="Switch Portal"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>
            <div className="h-6 w-px bg-line mx-1" />
          </>
        )}

        <button
          type="button"
          onClick={logout}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 text-[13px] font-semibold text-soft transition-colors hover:bg-rose-light hover:text-rose hover:border-rose-mid"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}
