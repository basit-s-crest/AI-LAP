"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { useAppSelector } from "@/hooks/redux";
import { useCoachesQuery } from "@/hooks/api/use-coaches";
import { useMoodTrend } from "@/hooks/api/use-mood";
import { useGroups } from "@/hooks/groups/useGroups";
import { cn } from "@/lib/cn";

const QUICK_ACCESS = [
  { id: "empowerment-kit", l: "Empowerment Kit", d: "Videos & resources", e: "🎬", p: "/empowerment-kit" },
  { id: "crisis-help", l: "Crisis Help", d: "Immediate support", e: "🆘", p: "/resources" },
  { id: "tech-support", l: "Tech Support", d: "Having issues?", e: "💬", p: "/resources" },
] as const;

export function UserDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const name = user?.firstName || user?.lastName || "there";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const { data: coaches = [] } = useCoachesQuery();
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const { data: weekMood } = useMoodTrend(7);
  const { data: monthMood } = useMoodTrend(30);
  const joined = groups.filter((g) => g.joined);

  const mockMoodHistory = [
    { d: "M", v: 3 },
    { d: "T", v: 4 },
    { d: "W", v: 2 },
    { d: "T", v: 4 },
    { d: "F", v: 5 },
    { d: "S", v: 4 },
    { d: "S", v: 3 }
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.6fr_1.2fr] anim-up">
      {/* ── Left Column: User Profile & Goals ── */}
      <div className="flex flex-col gap-6">
        {/* Profile Card */}
        <div className="card text-center p-5">
          <div className="w-[72px] h-[72px] rounded-full bg-[var(--sage-light)] border-2 border-[var(--sage-mid)] mx-auto mb-3 flex items-center justify-center text-3xl">
            {user?.avatarEmoji || "👩🏾"}
          </div>
          <h3 className="serif text-lg text-ink mb-0.5">{name}</h3>
          <p className="text-xs text-soft mb-3">Premium Member</p>
          <div className="flex justify-center gap-1.5 flex-wrap mb-4">
            <span className="tag text-[9.5px] py-0.5 px-1.5">BIPOC</span>
            <span className="tag text-[9.5px] py-0.5 px-1.5">LGBTQ+ Ally</span>
          </div>
          <div className="border-t border-[#D2DBE3] pt-4 grid grid-cols-2 gap-3 text-left">
            <div>
              <div className="text-[10px] text-ghost font-bold uppercase">Sessions</div>
              <div className="serif text-base text-ink mt-0.5">6 Completed</div>
            </div>
            <div>
              <div className="text-[10px] text-ghost font-bold uppercase">Streak</div>
              <div className="serif text-base text-ink mt-0.5">
                {monthMood?.totalTracked ?? 16} Days
              </div>
            </div>
          </div>
        </div>

        {/* Goals Card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="section-label mb-0 text-[11px]">Monthly Goals</div>
            <span className="badge b-sage text-[9.5px] py-0.5 px-2">On track</span>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs">
                <span className="text-soft font-semibold">Coaching</span>
                <span className="font-bold text-ink">{joined.length} / 4</span>
              </div>
              <div className="progress">
                <div className="progress-fill bg-[var(--sage)]" style={{ width: `${Math.min((joined.length / 4) * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs">
                <span className="text-soft font-semibold">Check-ins</span>
                <span className="font-bold text-ink">
                  {weekMood?.totalTracked ?? 5} / 7
                </span>
              </div>
              <div className="progress">
                <div className="progress-fill bg-[var(--teal)]" style={{ width: `${Math.min(((weekMood?.totalTracked ?? 5) / 7) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Center Column: Welcome, Check-In, Groups ── */}
      <div className="flex flex-col gap-6">
        {/* Greeting Banner */}
        <div className="card bg-[var(--pride-grad-soft)] border-[#A8B7C7] p-6 relative overflow-hidden min-h-[120px] flex items-center">
          <div className="relative z-10">
            <h2 className="serif text-[22px] text-ink mb-1">{greeting}, {name} 🌿</h2>
            <p className="text-soft text-[13px] max-w-[440px] leading-relaxed">
              Welcome back to your safe space. Take a moment to check in with yourself.
            </p>
          </div>
        </div>

        {/* Daily Check-in */}
        <div className="card p-6">
          <div className="section-label">Daily Check-In</div>
          <div className="font-bold text-ink text-base mb-3">How are you feeling right now?</div>
          <div className="grid grid-cols-5 gap-2.5">
            {[
              { value: 5, emoji: "😊", label: "Great" },
              { value: 4, emoji: "🙂", label: "Good" },
              { value: 3, emoji: "😐", label: "Okay" },
              { value: 2, emoji: "😟", label: "Low" },
              { value: 1, emoji: "😔", label: "Hard" },
            ].map((m) => (
              <Link key={m.value} href="/mood-mapping" className="no-underline">
                <div className="rounded-xl border border-[#D2DBE3] p-3 text-center bg-white hover:border-[var(--sage)] hover:bg-[var(--sage-light)] transition-all">
                  <div className="text-2xl mb-1">{m.emoji}</div>
                  <div className="text-[10px] font-bold text-soft">{m.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Your Communities */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="serif text-base text-ink mb-0">Your Communities</div>
            <Link href="/community-groups">
              <button type="button" className="btn btn-ghost btn-sm text-[12px] text-[var(--sage)] font-bold py-1 px-2 border-none">
                Explore All
              </button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groupsLoading ? (
              <div className="card p-4 text-center text-xs text-ghost">Loading groups...</div>
            ) : joined.length === 0 ? (
              <div className="card p-4 text-center text-xs text-ghost">Join a community group to see it here.</div>
            ) : (
              joined.slice(0, 2).map((g) => (
                <Link key={g.id} href={`/community-groups/${g.id}`} className="group-card hover:no-underline">
                  <div className="group-banner bg-[#E6EFF5] h-[60px] flex items-center justify-center text-2xl">{g.emoji || "🧑‍🤝‍🧑"}</div>
                  <div className="group-body p-3 flex flex-col justify-between" style={{ minHeight: "100px" }}>
                    <div>
                      <div className="group-name text-sm font-bold text-ink mb-1 truncate">{g.name}</div>
                      <div className="group-desc text-xs text-soft line-clamp-2 h-8 leading-normal mb-2">{g.desc || "Peer community space."}</div>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#D2DBE3] pt-2 mt-2">
                      <span className="text-[10px] text-ghost font-semibold">{g.posts ?? 0} posts</span>
                      <span className="badge b-sage text-[9px] py-0.5 px-2">Joined</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
            
            <Link href="/community-groups" className="group-card border-dashed border-2 border-[#A8B7C7] flex items-center justify-center min-h-[160px] bg-transparent hover:bg-[var(--sage-light)] hover:border-[var(--sage)] transition-colors">
              <div className="text-center">
                <div className="text-2xl mb-1 text-[var(--sage)]">＋</div>
                <div className="text-xs font-semibold text-[var(--sage)]">Explore Groups</div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Right Column: Appointments & Wellbeing Trend ── */}
      <div className="flex flex-col gap-6">
        {/* Upcoming Appointments */}
        <div className="card p-5">
          <div className="section-label mb-3">Upcoming Schedule</div>
          <div className="flex flex-col gap-3">
            {coaches.length > 0 ? (
              coaches.slice(0, 2).map((c, idx) => (
                <Link key={c.id} href={`/coaching/${c.id}`}>
                  <div className="upcoming p-3 flex items-center gap-3">
                    <div className="upcoming-date w-11 h-11 bg-[var(--sage-light)] border border-[var(--sage-mid)] rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-[var(--sage)]">{idx === 0 ? "TUE" : "THU"}</span>
                      <span className="text-lg font-extrabold text-[var(--sage)] leading-none">{idx === 0 ? "17" : "19"}</span>
                    </div>
                    <div className="upcoming-info flex-1 min-w-0">
                      <div className="upcoming-name text-sm font-bold text-ink truncate">{c.name}</div>
                      <div className="upcoming-meta text-xs text-soft">{idx === 0 ? "3:00 PM · Video" : "6:00 PM · Chat"}</div>
                    </div>
                    <div className="upcoming-action flex-shrink-0">
                      <button type="button" className="btn btn-outline btn-sm text-[11px] py-1 px-2.5">
                        {idx === 0 ? "Join" : "View"}
                      </button>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="upcoming p-3 text-center text-xs text-ghost">No sessions scheduled</div>
            )}
          </div>
        </div>

        {/* Weekly wellbeing trend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="section-label mb-0">Weekly Mood Trend</div>
            <div className="text-xs font-bold text-ink">
              Avg: {weekMood?.averageMood ? weekMood.averageMood.toFixed(1) : "3.6"}{" "}
              <span className="text-ghost font-normal">/5</span>
            </div>
          </div>
          <div className="card card-sm border-[#D2DBE3] shadow-none p-3 bg-[var(--bg-surface-2)]">
            <div className="mood-week h-[60px] flex items-end justify-between gap-1.5 mb-0">
              {mockMoodHistory.map((d) => (
                <div key={d.d} className="mood-day flex flex-col items-center flex-1 gap-1 h-full justify-end">
                  <div
                    className="mood-bar w-2 rounded-md"
                    style={{
                      height: `${d.v * 10}px`,
                      background: d.v >= 4 ? "var(--sage)" : d.v === 3 ? "var(--amber)" : "var(--rose)",
                    }}
                  />
                  <div className="mood-day-label text-[9px] font-bold text-soft leading-none mt-0.5">{d.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
