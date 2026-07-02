"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/types/role";
import { useHydratedPlatformBranding, getLogoUrl } from "@/hooks/useHydratedPlatformBranding";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";
import Image from "next/image";

const cards: {
  role: Role;
  chip: string;
  cardClass: string;
  iconBg: string;
  icon: string;
  title: string;
  desc: string;
}[] = [
  {
    role: "user",
    chip: "Member",
    cardClass: "c-sage",
    iconBg: "bg-sage",
    icon: "🌿",
    title: "Member App",
    desc: "Sign up, onboarding, mood tracking, coaching sessions, community groups, and resources.",
  },
  {
    role: "superadmin",
    chip: "Full Access",
    cardClass: "c-amber",
    iconBg: "bg-amber",
    icon: "🛡️",
    title: "Super Admin",
    desc: "Full platform control — manage users, coaches, groups, orgs, and content.",
  },
  {
    role: "organization",
    chip: "Org Admin",
    cardClass: "c-teal",
    iconBg: "bg-teal",
    icon: "🏢",
    title: "Client Organization",
    desc: "University, insurer, or NGO portal — member outcomes, engagement, and reports.",
  },
  {
    role: "coach",
    chip: "Coach",
    cardClass: "c-rose",
    iconBg: "bg-rose",
    icon: "🧑‍⚕️",
    title: "Coach Portal",
    desc: "Manage your schedule, clients, messages, session notes, and availability.",
  },
];

export function RoleGate() {
  const router = useRouter();
  const { brandTitle, brandTagline, logoUrl } = useHydratedPlatformBranding();
  const { data: platformSettings } = usePublicPlatformSettings();

  const enter = (role: Role) => {
    router.push(`/login?role=${role}`);
  };

  return (
    <div className="gate anim-scale">
      <div className="gate-header">
        <div className="flex items-center gap-2">
          <img src={getLogoUrl(logoUrl)} alt="SafeCircle Logo" style={{ height: "64px", width: "64px", objectFit: "contain", marginRight: "-8px", marginLeft: "-12px" }} />
          <div className="gate-brand-row" style={{ alignItems: "center" }}>
            <div className="gate-wordmark">{brandTitle}</div>
            <div className="gate-tagline">{brandTagline}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/SafeCircle_Documentation.html"
            target="_blank"
            rel="noopener noreferrer"
            className="gate-proto-badge hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            style={{ textDecoration: "none", borderColor: "var(--plum)" }}
          >
            <span>📄</span>
            <span style={{ color: "var(--plum)" }}><strong>View Documentation</strong></span>
          </a>
          <div className="gate-proto-badge">
            <span>🌿</span>
            <span>{brandTitle} &nbsp;·&nbsp; <strong>Platform Prototype V1</strong></span>
          </div>
        </div>
      </div>
      
      <div className="gate-welcome-section">
        <div className="gate-welcome-left">
          <div className="gate-mission-text">
            Support that <em>actually sees you</em> — built for BIPOC, LGBTQIA+, immigrant, and first-gen young people.
          </div>
          <div className="gate-pills">
            <div className="gate-pill">BIPOC</div>
            <div className="gate-pill">LGBTQIA+</div>
            <div className="gate-pill">Immigrant</div>
            <div className="gate-pill">First-Gen</div>
            <div className="gate-pill">Youth 14–30</div>
          </div>
        </div>
        <div className="gate-welcome-right">
          <div className="gate-right-head">
            <h2>Choose your portal</h2>
            <p>Select a role to explore the full platform experience</p>
          </div>
        </div>
      </div>

      <div className="portal-grid">
        {cards.map((c, i) => (
          <button
            key={c.role}
            type="button"
            onClick={() => enter(c.role)}
            className={`portal-card ${c.cardClass} anim-up text-left`}
            style={{ animationDelay: `${(i + 1) * 0.05}s` }}
          >
            <div>
              <div className={`pc-icon ${c.iconBg}`}>{c.icon}</div>
              <div className="pc-label">{c.chip}</div>
              <div className="pc-title">{c.title}</div>
              <div className="pc-desc">{c.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center w-full anim-up" style={{ animationDelay: "0.3s" }}>
        <a
          href="/SafeCircle_Documentation.html"
          target="_blank"
          rel="noopener noreferrer"
          className="portal-card c-plum flex flex-col md:flex-row items-start md:items-center gap-6 w-full text-left p-6 md:p-8 group"
          style={{ minHeight: "auto", textDecoration: "none", cursor: "pointer" }}
        >
          <div className="pc-icon bg-plum flex-shrink-0" style={{ marginBottom: 0, width: "48px", height: "48px", fontSize: "24px" }}>
            📄
          </div>
          <div className="flex-grow">
            <div className="pc-label" style={{ color: "var(--plum)", fontWeight: 700, fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>Documentation</div>
            <div className="pc-title" style={{ fontSize: "20px", marginTop: "4px", fontWeight: 800 }}>SafeCircle Interactive System Documentation</div>
            <div className="pc-desc" style={{ marginTop: "4px", fontSize: "13px", color: "var(--ink-soft)" }}>
              Explore the complete design guidelines, HIPAA security implementation plans, risk engines, and database models.
            </div>
          </div>
          <div 
            className="hidden md:flex items-center justify-center rounded-full bg-plum-light w-10 h-10 text-plum font-bold text-xl transition-transform group-hover:translate-x-2"
            style={{ color: "var(--plum)", backgroundColor: "var(--plum-light)", flexShrink: 0 }}
          >
            →
          </div>
        </a>
      </div>
    </div>
  );
}
