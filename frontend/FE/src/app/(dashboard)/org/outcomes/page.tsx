"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useOrgOutcomes } from "@/hooks/org/useOrgOutcomes";

export default function OrgOutcomesPage() {
  const { data, isPending, isError, error } = useOrgOutcomes();

  return (
    <DashboardLayout title="Outcomes & Reports">
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[#F0EBE1]"
            />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-sm text-danger">{error.message || "Failed to load outcomes"}</Card>
      ) : data ? (
        <div className="animate-fadeIn">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatsCard
              label="PHQ-8 Improvement"
              value={data.phqImprovement !== null ? String(data.phqImprovement) : "—"}
              sub="avg reduction vs baseline"
              accent="sage"
            />
            <StatsCard
              label="GAD-7 Improvement"
              value={data.gadImprovement !== null ? String(data.gadImprovement) : "—"}
              sub="avg reduction vs baseline"
              accent="blue"
            />
            <StatsCard
              label="Retention Rate"
              value={`${data.retentionRate}%`}
              sub="30-day active users"
              accent="gold"
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-serif text-lg font-semibold">PHQ-8 Score Distribution</h3>
              {data.phqDistribution.map((row) => (
                <div key={row.label} className="mb-3">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="font-mono text-xs text-mid">{row.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
                    <div
                      className="h-full rounded"
                      style={{ width: `${row.percent}%`, background: row.color }}
                    />
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <h3 className="mb-3 font-serif text-lg font-semibold">Key Metrics</h3>
              <ul className="space-y-2 text-sm text-mid">
                <li>Members with 3+ sessions: {data.keyMetrics.membersWith3PlusSessions}%</li>
                <li>Avg sessions per member: {data.keyMetrics.avgSessionsPerMember}</li>
                <li>
                  Coach satisfaction rating:{" "}
                  {data.keyMetrics.coachSatisfactionRating !== null
                    ? `${data.keyMetrics.coachSatisfactionRating} / 5`
                    : "—"}
                </li>
                <li>Crisis escalations: {data.keyMetrics.crisisEscalations}</li>
                <li>Members who joined a group: {data.keyMetrics.membersInGroup}%</li>
              </ul>
            </Card>
          </div>

          <Card>
            <h3 className="mb-4 font-serif text-lg font-semibold">Download Reports</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                "📊 Monthly Outcomes Report — Mar 2026 · PDF",
                "📋 Member Engagement Summary — Q1 2026 · Excel",
                "🔒 HIPAA Compliance Report — Annual · PDF",
              ].map((name, index) => (
                <div key={index} className="rounded-xl border border-line bg-[#F7F3EB] p-4">
                  <p className="mb-3 text-sm font-semibold text-ink">{name}</p>
                  <Button type="button" size="sm" variant="ghost">
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
