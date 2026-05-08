"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { useAppSelector } from "@/hooks/redux";
import { useCoachesQuery } from "@/hooks/api/use-coaches";
import groups from "@/mock/groups.json";
import type { CommunityGroup } from "@/types/group";

const QUICK_ACCESS = [
  { id: "empowerment-kit", l: "Empowerment Kit", d: "Videos & resources", e: "🎬", p: "/empowerment-kit" },
  { id: "crisis-help", l: "Crisis Help", d: "Immediate support", e: "🆘", p: "/resources" },
  { id: "tech-support", l: "Tech Support", d: "Having issues?", e: "💬", p: "/resources" },
] as const;

export function UserDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const name = user?.firstName ?? "Amara";
  const { data: coaches = [] } = useCoachesQuery();
  const joined = (groups as CommunityGroup[]).filter((g) => g.joined);

  return (
    <div className="animate-fadeIn">
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-sidebar px-7 py-7 text-[#FDFAF5]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 60%, rgba(78,140,88,.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(179,90,56,.10) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-[1] flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1.5 text-[11px] uppercase tracking-[2px] text-sage-light">
              Good morning
            </div>
            <h2 className="font-serif text-[30px] font-bold">Hello, {name} ✦</h2>
            <p className="text-sm text-[#FDFAF5]/50">How are you showing up for yourself today?</p>
          </div>
          <Link href="/mood-mapping">
            <Button
              variant="outline"
              size="sm"
              className="border-sage-light text-sage-light hover:bg-white/5"
            >
              Log Mood →
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Days Tracked" value="24" sub="this month" accent="sage" />
        <StatsCard label="Sessions" value="6" sub="with coaches" accent="blue" />
        <StatsCard label="Communities" value="2" sub="groups joined" accent="gold" />
        <StatsCard label="Avg Mood" value="3.8" sub="this week" accent="terra" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3.5 font-serif text-lg font-semibold text-ink">Your Groups</h3>
          {joined.map((g) => (
            <Link key={g.id} href={`/community-groups/${g.id}`}>
              <Card variant="sm" hoverable className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{g.emoji}</span>
                    <div>
                      <div className="text-sm font-semibold">{g.name}</div>
                      <div className="text-sm text-dim">{g.posts} new posts</div>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-sage">→</span>
                </div>
              </Card>
            </Link>
          ))}
          <Link href="/community-groups">
            <Button variant="ghost" size="sm" fullWidth>
              Browse All Groups
            </Button>
          </Link>
        </div>
        <div>
          <h3 className="mb-3.5 font-serif text-lg font-semibold text-ink">Your Coaches</h3>
          {coaches.slice(0, 2).map((c) => (
            <Link key={c.id} href={`/coaching/${c.id}`}>
              <Card variant="sm" hoverable className="mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-xl"
                    style={{ background: c.bg }}
                  >
                    {c.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-sm text-dim">{c.spec.split("·")[0]?.trim()}</div>
                  </div>
                  <span className="text-[11.5px] font-semibold text-[#2E7D4F]">
                    <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#2E7D4F]" />
                    Available
                  </span>
                </div>
              </Card>
            </Link>
          ))}
          <Link href="/coaching">
            <Button variant="ghost" size="sm" fullWidth>
              View All Coaches
            </Button>
          </Link>
        </div>
      </div>

      <h3 className="mb-3 font-serif text-lg font-semibold text-ink">Quick Access</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {QUICK_ACCESS.map((q) => (
          <Link key={q.id} href={q.p}>
            <Card variant="sm" hoverable>
              <div className="mb-2 text-[28px]">{q.e}</div>
              <div className="text-sm font-semibold">{q.l}</div>
              <div className="text-sm text-mid">{q.d}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
