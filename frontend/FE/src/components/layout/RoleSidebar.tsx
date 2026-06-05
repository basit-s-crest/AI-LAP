"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { navForRole, roleAccent, roleSidebarLabel, type NavItem } from "@/constants/navigation";
import type { Role } from "@/types/role";
import { Avatar } from "@/components/ui/Avatar";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { useRouter } from "next/navigation";
import { useHydratedPlatformBranding, getLogoUrl } from "@/hooks/useHydratedPlatformBranding";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";
import Image from "next/image";

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
  const label = roleSidebarLabel(role);
  const items = navForRole(role);
  const groups = groupItems(items);
  const { brandTitle, logoUrl } = useHydratedPlatformBranding();

  const getActiveClass = (item: NavItem) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!isActive) return "";
    if (role === "coach") return "active-teal";
    if (role === "organization" || role === "superadmin") return "active-amber";
    return "active";
  };

  const navBody = (
    <>
      <div className="nav-brand" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "8px", paddingBottom: "20px", borderBottom: "1px solid var(--border)", marginBottom: "20px" }}>
        <img src={getLogoUrl(logoUrl)} alt="SafeCircle Logo" style={{ height: "64px", width: "64px", objectFit: "contain", marginRight: "-8px", marginLeft: "-12px", flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div className="nav-logo" style={{ fontSize: "22px", lineHeight: "1.1" }}>{brandTitle}</div>
          <div className="nav-role" style={{ marginTop: "4px", color: role === "coach" ? "var(--teal)" : role === "superadmin" || role === "organization" ? "var(--amber)" : "var(--sage)" }}>{label}</div>
        </div>
      </div>
      <div className="nav-body">
        {groups.map((g, gi) => (
          <div key={`${g.section}-${gi}`}>
            {gi > 0 && g.section === "Switch Portal" ? (
              <div className="nav-divider" />
            ) : null}
            {g.section ? (
              <div className="nav-group-label">
                {g.section}
              </div>
            ) : null}
            {g.items.map((item) => {
              const activeClass = getActiveClass(item);
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.href}::${item.label}`}
                  href={item.href}
                  className={`nav-item ${activeClass}`}
                >
                  <span className="nav-icon"><Icon className="h-[18px] w-[18px]" /></span>
                  <span className="nav-label">{item.label}</span>
                  {item.badge ? (
                    <span className="nav-badge">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );

  if (variant === "drawer") {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col bg-white p-6 border-r border-[#D2DBE3]">{navBody}</aside>
    );
  }

  return (
    <div className="relative w-[260px] shrink-0 md:h-full">
      <div
        aria-hidden
        className="pointer-events-none hidden h-full min-h-screen w-[260px] shrink-0 md:block"
      />
      <nav className="nav md:fixed md:left-0 md:top-0 md:z-30">
        {navBody}
      </nav>
    </div>
  );
}
