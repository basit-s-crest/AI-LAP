"use client";
 
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { PlatformActivityChart } from "@/components/charts/PlatformActivityChart";
import { useOrgOverview } from "@/hooks/org/useOrgOverview";
 
export function OrgDashboardHome() {
  const { data, isPending, isError, error } = useOrgOverview();
 
  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[var(--bg-surface-2)]" />
        ))}
      </div>
    );
  }
 
  if (isError) {
    return (
      <Card className="text-sm text-danger">
        {error?.message || "Failed to load overview"}
      </Card>
    );
  }
 
  if (!data) return null;
 
  return (
    <div className="flex flex-col gap-6 anim-up">
      <div className="card" style={{ borderLeft: "4px solid var(--teal)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="serif text-lg text-ink font-extrabold">{data.orgName}</div>
            <div className="text-xs text-soft">
              {data.type} · {data.plan} Plan · {data.totalCoaches} coaches assigned
            </div>
          </div>
          <span className="badge b-teal uppercase text-[10px] font-bold tracking-wide">{data.type}</span>
        </div>
      </div>
 
      <div className="stat-grid sg-4">
        {/* Card 1: Total Members */}
        <div className="stat-card sc-teal">
          <div className="stat-label">Total Members</div>
          <div className="stat-value">{data.totalMembers}</div>
          <div className="stat-sub">enrolled students</div>
          <div className="stat-icon bg-teal">👥</div>
        </div>

        {/* Card 2: Active (30d) */}
        <div className="stat-card sc-sage">
          <div className="stat-label">Active (30d)</div>
          <div className="stat-value">{data.activeMembers}</div>
          <div className="stat-sub">{Math.round(data.engagementRate)}% engagement</div>
          <div className="stat-icon bg-sage">✅</div>
        </div>

        {/* Card 3: Sessions This Month */}
        <div className="stat-card sc-amber">
          <div className="stat-label">Sessions This Month</div>
          <div className="stat-value">{data.sessionsThisMonth}</div>
          <div className="stat-sub">completed meetings</div>
          <div className="stat-icon bg-amber">💬</div>
        </div>

        {/* Card 4: Avg PHQ-8 Score */}
        <div className="stat-card sc-rose">
          <div className="stat-label">Avg PHQ-8 Score</div>
          <div className="stat-value">{data.avgPhqScore ?? "—"}</div>
          <div className="stat-sub">wellbeing index</div>
          <div className="stat-icon bg-rose">😊</div>
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="serif text-lg text-ink mb-4 font-bold">Member Engagement</h3>
          <PlatformActivityChart data={data.engagementSeries ?? []} color="#53A4D0" />
        </div>
 
        <div className="card">
          <h3 className="section-label mb-3">Mood Distribution</h3>
          {(data.moodDistribution ?? []).map((row) => (
            <div key={row.key} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold">{row.label}</div>
                <div className="text-xs font-bold text-soft">{row.percent}%</div>
              </div>
              <div className="progress" style={{ height: "6px" }}>
                <div
                  className="progress-fill"
                  style={{ width: `${row.percent}%`, background: row.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {(data.completionStats ?? []).map((item) => (
          <div key={item.label} className="card lift text-center">
            <div className="serif text-[40px] font-bold" style={{ color: item.color }}>
              {item.percent}%
            </div>
            <div className="section-label mt-2">
              {item.label}
            </div>
            <div className="text-xs text-soft">{item.count} members</div>
          </div>
        ))}
      </div>
    </div>
  );
}
 
 