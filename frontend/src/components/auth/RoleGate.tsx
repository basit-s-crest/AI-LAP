"use client";

import { useRouter } from "next/navigation";
import type { Role } from "@/types/role";

const cards: {
  role: Role;
  chip: string;
  chipClass: string;
  icon: string;
  title: string;
  desc: string;
  full?: boolean;
}[] = [
  {
    role: "user",
    chip: "MEMBER",
    chipClass: "bg-sage-tint text-sage",
    icon: "🌿",
    title: "Member App",
    desc: "The full Azadi member experience — sign up, onboarding assessments, mood tracking, coaching sessions, community groups, and resources.",
  },
  {
    role: "superadmin",
    chip: "FULL ACCESS",
    chipClass: "bg-terra-tint text-terra",
    icon: "🛡️",
    title: "Super Admin",
    desc: "Full platform control — manage users, coaches, groups, media, content moderation, client orgs, and activity logs.",
  },
  {
    role: "organization",
    chip: "ORG ADMIN",
    chipClass: "bg-gold-tint text-gold",
    icon: "🏢",
    title: "Client Organization",
    desc: "University, insurer, or NGO portal — view member outcomes, engagement metrics, coach assignments, and reports.",
  },
  {
    role: "coach",
    chip: "COACH",
    chipClass: "bg-blue-tint text-blue",
    icon: "🧑‍⚕️",
    title: "Coach Portal",
    desc: "Manage your schedule, clients, messages, session notes, and availability for on-demand sessions.",
    full: true,
  },
];

export function RoleGate() {
  const router = useRouter();

  const enter = (role: Role) => {
    router.push(`/login?role=${role}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-8">
      <div className="w-full max-w-[740px]">
        <div className="mb-8 flex w-fit items-center gap-2.5 rounded-xl bg-sidebar px-[18px] py-2.5">
          <span>🌿</span>
          <span className="text-xs text-[#FDFAF5]/55">
            Azadi Health &nbsp;·&nbsp;{" "}
            <strong className="text-sage-light">Platform Prototype V5</strong> &nbsp;·&nbsp; Click any
            role to explore
          </span>
        </div>
        <h1 className="mb-1 font-serif text-[52px] font-bold leading-none tracking-tight text-ink">
          Azadi Health
        </h1>
        <p className="mb-10 text-[15px] text-mid">Select a portal to explore the platform</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <button
              key={c.role}
              type="button"
              onClick={() => enter(c.role)}
              className={
                c.full
                  ? "group col-span-1 flex cursor-pointer items-start gap-7 overflow-hidden rounded-[20px] border-[1.5px] border-[rgba(60,50,40,0.1)] bg-card p-8 text-left transition-all hover:-translate-y-0.5 hover:border-[rgba(60,50,40,0.22)] hover:shadow-[0_8px_32px_rgba(60,50,40,0.12)] disabled:pointer-events-none disabled:opacity-60 md:col-span-2 md:flex-row md:items-center"
                  : "group cursor-pointer rounded-[20px] border-[1.5px] border-[rgba(60,50,40,0.1)] bg-card p-8 text-left transition-all hover:-translate-y-0.5 hover:border-[rgba(60,50,40,0.22)] hover:shadow-[0_8px_32px_rgba(60,50,40,0.12)] disabled:pointer-events-none disabled:opacity-60"
              }
            >
              <div className={c.full ? "text-[44px] leading-none" : "mb-3.5 text-[38px]"}>
                {c.icon}
              </div>
              <div>
                <span
                  className={`mb-3 inline-block rounded-md px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${c.chipClass}`}
                >
                  {c.chip}
                </span>
                <div className="font-serif text-[21px] font-semibold text-ink">{c.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mid">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
