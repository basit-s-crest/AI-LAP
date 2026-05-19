"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatsCard } from "@/components/cards/StatsCard";
import { useAdminOrgOverview } from "@/hooks/admin/useAdminOrgOverview";
import { PlatformActivityChart } from "@/components/charts/PlatformActivityChart";
import { Button } from "@/components/ui/Button";

const moodRows = [
  ["😊 Great", 22, "#4E8C58"],
  ["🙂 Good", 38, "#7AB882"],
  ["😐 Okay", 25, "#B8832A"],
  ["😟 Low", 10, "#B35A38"],
  ["😔 Struggling", 5, "#C0392B"],
] as const;

const engagement = [
  28, 35, 42, 38, 55, 48, 62, 58, 70, 65, 78, 82, 90, 85, 95,
].map((value, index) => ({ label: String(index + 1), value }));

export default function AdminOrgDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  const router = useRouter();
  const { data, isPending, isError, error } = useAdminOrgOverview(orgId);

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <Topbar 
        title={data ? `${data.orgName} Dashboard` : "Organization Dashboard"}
        breadcrumbs={[
          { label: "Admin", href: "/admin" }, 
          { label: "Organizations", href: "/admin/orgs" }, 
          { label: data ? data.orgName : "Dashboard" }
        ]}
        right={
          <Button variant="ghost" size="sm" type="button" onClick={() => router.push("/admin/orgs")}>
            &larr; Back to Orgs
          </Button>
        }
      />
      <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
        {isPending ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[#F0EBE1]" />
            ))}
          </div>
        ) : isError ? (
          <Card className="text-sm text-danger">{error.message || "Failed to load overview"}</Card>
        ) : data ? (
          <div className="animate-fadeIn">
            <Card className="mb-6 border-l-4 border-gold">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold">{data.orgName}</div>
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
                accent="blue"
              />
              <StatsCard label="Sessions This Month" value={data.sessionsThisMonth} accent="gold" />
              <StatsCard
                label="Avg PHQ-8 Score"
                value={data.avgPhqScore ?? "—"}
                accent="terra"
              />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <h3 className="mb-4 font-serif text-lg font-semibold">Member Engagement</h3>
                <PlatformActivityChart data={engagement} color="#B8832A" />
              </Card>

              <Card>
                <h3 className="mb-3 font-serif text-lg font-semibold">Mood Distribution</h3>
                {moodRows.map(([label, percent, color]) => (
                  <div key={label} className="mb-3">
                    <div className="mb-1 flex items-center justify-between">
                      <div className="text-sm">{label}</div>
                      <div className="font-mono text-xs text-mid">{percent}%</div>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
                      <div className="h-full rounded" style={{ width: `${percent}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { label: "Completed Onboarding", percent: 92, color: "#4E8C58" },
                { label: "PHQ-8 Assessed", percent: 77, color: "#3A6E99" },
                { label: "At Least 1 Session", percent: 63, color: "#B8832A" },
              ].map((item) => (
                <Card key={item.label} className="text-center">
                  <div className="font-serif text-[40px] font-bold" style={{ color: item.color }}>
                    {item.percent}%
                  </div>
                  <div className="mt-2 text-[10.5px] font-bold uppercase tracking-wide text-dim">
                    {item.label}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
