"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/types/role";
import { useHydratedPlatformBranding } from "@/hooks/useHydratedPlatformBranding";
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
  const { brandTitle, brandTagline } = useHydratedPlatformBranding();
  const { data: platformSettings } = usePublicPlatformSettings();

  const enter = (role: Role) => {
    router.push(`/login?role=${role}`);
  };

  return (
    <div className="gate anim-scale">
      <div className="gate-header">
        <div className="gate-brand-row">
          <div className="gate-wordmark">{brandTitle}</div>
          <div className="gate-tagline">{brandTagline}</div>
        </div>
        <div className="gate-proto-badge">
          <span>🌿</span>
          <span>{brandTitle} &nbsp;·&nbsp; <strong>Platform Prototype V1</strong></span>
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
    </div>
  );
}
