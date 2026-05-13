"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { navForRole, roleAccent, roleSidebarLabel, type NavItem } from "@/constants/navigation";
import type { Role } from "@/types/role";
import { Avatar } from "@/components/ui/Avatar";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { logout } from "@/store/slices/authSlice";
import { useRouter } from "next/navigation";

function groupItems(items: NavItem[]) {
  const sections: { section: string; items: NavItem[] }[] = [];
  let current: string | undefined;
  for (const item of items) {
    const sec = item.section ?? "";
    if (sections.length === 0 || sec !== current) {
      current = sec;
      sections.push({ section: sec, items: [] });
    }
    sections[sections.length - 1].items.push(item);
  }
  return sections;
}

export function RoleSidebar({
  role,
  userName,
  onSwitchRole,
  variant = "dock",
}: {
  role: Role;
  userName: string;
  onSwitchRole?: () => void;
  /** `dock`: fixed to viewport in desktop layout. `drawer`: flows inside the mobile drawer. */
  variant?: "dock" | "drawer";
}) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const accent = roleAccent(role);
  const label = roleSidebarLabel(role);
  const items = navForRole(role);
  const groups = groupItems(items);

  const inner = (
    <>
      <div className="border-b border-white/[0.08] px-[22px] pb-[18px] pt-6">
        <div className="font-serif text-[21px] font-bold tracking-wide text-[#FDFAF5]">
          Azadi Health
        </div>
        <div
          className="mt-0.5 text-[9.5px] uppercase tracking-[2px] text-white/30"
          style={{ color: accent }}
        >
          {label}
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-2.5">
        {groups.map((g, gi) => (
          <div key={`${g.section}-${gi}`}>
            {gi > 0 && g.section === "Switch Portal" ? (
              <div className="mx-[22px] my-2.5 h-px bg-white/[0.08]" />
            ) : null}
            {g.section ? (
              <div
                className={cn(
                  "px-[22px] pb-1.5 pt-4 text-[9px] font-bold uppercase tracking-[2px] text-white/25",
                  g.section === "Switch Portal" && "text-blue/80 opacity-80"
                )}
              >
                {g.section}
              </div>
            ) : null}
            {g.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const memberActive =
                role === "coach"
                  ? "border-l-blue bg-blue/25 text-[#FDFAF5]"
                  : "border-l-sage-light bg-sage/[0.18] text-[#FDFAF5]";
              return (
                <Link
                  key={`${item.href}::${item.label}`}
                  href={item.href}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 border-l-[2.5px] border-transparent px-[22px] py-2.5 text-[13.5px] text-white/[0.48] transition-all hover:bg-white/[0.04] hover:text-white/[0.85]",
                    active && !item.portal && memberActive,
                    active && item.portal && "border-l-blue bg-blue/25 text-[#FDFAF5]",
                    item.portal && "text-white/[0.42] hover:bg-blue/10"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto rounded-[10px] bg-terra px-[7px] py-0.5 text-[9px] font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.08] px-[22px] pb-[18px] pt-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar label={userName} style={{ background: accent }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-[#FDFAF5]">{userName}</div>
            <div className="text-[10px] text-white/30">{label}</div>
          </div>
          {onSwitchRole ? (
            <button
              type="button"
              className="ml-auto rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/40 transition-colors hover:border-white/35 hover:text-[#FDFAF5]"
              onClick={onSwitchRole}
            >
              ⇄
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-md border border-white/10 py-1.5 text-xs text-white/50 hover:bg-white/5"
          onClick={() => {
            dispatch(logout());
            router.push("/");
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );

  if (variant === "drawer") {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col bg-sidebar">{inner}</aside>
    );
  }

  return (
    <div className="relative w-[240px] shrink-0 md:h-full">
      <div
        aria-hidden
        className="pointer-events-none hidden h-full min-h-screen w-[240px] shrink-0 md:block"
      />
      <aside className="flex h-full min-h-0 w-[240px] shrink-0 flex-col bg-sidebar md:fixed md:left-0 md:top-0 md:z-30 md:h-screen">
        {inner}
      </aside>
    </div>
  );
}
