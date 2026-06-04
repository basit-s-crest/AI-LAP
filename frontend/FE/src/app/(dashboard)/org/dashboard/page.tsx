"use client";
 
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatsCard } from "@/components/cards/StatsCard";
import { useOrgOverview } from "@/hooks/org/useOrgOverview";
import { OrgEngagementChart } from "@/components/charts/OrgEngagementChart";
 
export default function OrgDashboardPage() {
  const { data, isPending, isError, error } = useOrgOverview();
 
  return (
    <DashboardLayout title="Overview">
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[var(--bg-surface-2)]" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-sm text-danger">{error.message || "Failed to load overview"}</Card>
      ) : data ? (
        <div className="anim-up">
          <Card className="mb-6 border-l-4 border-amber">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-ink">{data.orgName}</div>
                <div className="text-xs text-dim">
                  {data.type} · {data.plan} Plan · {data.totalCoaches} coaches assigned
                </div>
              </div>
              <Badge variant="gold">{data.type}</Badge>
            </div>
          </Card>

          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard label="Total Members" value={data.totalMembers} accent="sage" />
            <StatsCard
              label="Active (30d)"
              value={data.activeMembers}
              sub={`${Math.round(data.engagementRate)}% engagement`}
              accent="teal"
            />
            <StatsCard label="Sessions This Month" value={data.sessionsThisMonth} accent="amber" />
            <StatsCard
              label="Avg PHQ-8 Score"
              value={data.avgPhqScore ?? "—"}
              accent="terra"
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 serif text-lg font-semibold text-ink">Member Engagement</h3>
              <OrgEngagementChart
                data={data.engagementSeries ?? []}
                color="var(--amber)"
              />
            </Card>

            <Card>
              <h3 className="mb-3 serif text-lg font-semibold text-ink">Mood Distribution</h3>
              {(data.moodDistribution ?? []).map((row) => (
                <div key={row.key} className="mb-3 text-ink">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="text-sm">{row.label}</div>
                    <div className="font-mono text-xs text-mid">{row.percent}%</div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-[var(--bg-surface-2)]">
                    <div
                      className="h-full rounded"
                      style={{ width: `${row.percent}%`, background: row.color }}
                    />
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(data.completionStats ?? []).map((item) => (
              <Card key={item.label} className="text-center">
                <div className="serif text-[40px] font-bold" style={{ color: item.color }}>
                  {item.percent}%
                </div>
                <div className="mt-2 text-[10.5px] font-bold uppercase tracking-wide text-dim">
                  {item.label}
                </div>
                <div className="mt-1 text-xs text-dim">{item.count} members</div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
 