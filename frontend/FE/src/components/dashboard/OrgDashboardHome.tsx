"use client";

import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { Badge } from "@/components/ui/Badge";
import { PlatformActivityChart } from "@/components/charts/PlatformActivityChart";

const engagement = [
  28, 35, 42, 38, 55, 48, 62, 58, 70, 65, 78, 82, 90, 85, 95,
].map((value, i) => ({ label: String(i), value }));

const moodRows = [
  ["😊 Great", 22, "#4E8C58"],
  ["🙂 Good", 38, "#7AB882"],
  ["😐 Okay", 25, "#B8832A"],
  ["😟 Low", 10, "#B35A38"],
  ["😔 Struggling", 5, "#C0392B"],
] as const;

export function OrgDashboardHome() {
  return (
    <div className="animate-fadeIn">
      <Card className="mb-6 border-l-4 border-gold">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold">State University System</div>
            <div className="text-xs text-dim">
              University · Enterprise Plan · 4 coaches assigned
            </div>
          </div>
          <Badge variant="gold">University</Badge>
        </div>
      </Card>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Total Members" value="312" trend="↑ 14 this week" trendUp accent="sage" />
        <StatsCard label="Active (30d)" value="248" sub="79.5% engagement" accent="blue" />
        <StatsCard label="Sessions This Month" value="89" trend="↑ 18%" trendUp accent="gold" />
        <StatsCard label="Avg PHQ-8 Score" value="7.2" trend="↓ 1.4 from baseline" trendUp={false} accent="terra" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-serif text-lg font-semibold">Member Engagement — 15 Days</h3>
          <PlatformActivityChart data={engagement} color="#B8832A" />
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Mood Distribution</h3>
          {moodRows.map(([l, p, c]) => (
            <div key={l} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm">{l}</div>
                <div className="font-mono text-xs text-mid">{p}%</div>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
                <div className="h-full rounded" style={{ width: `${p}%`, background: c }} />
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { l: "Completed Onboarding", v: "287", p: 92, c: "#4E8C58" },
          { l: "PHQ-8 Assessed", v: "241", p: 77, c: "#3A6E99" },
          { l: "At Least 1 Session", v: "198", p: 63, c: "#B8832A" },
        ].map((m) => (
          <Card key={m.l} className="text-center">
            <div className="font-serif text-[40px] font-bold" style={{ color: m.c }}>
              {m.v}
            </div>
            <div className="mt-2 text-[10.5px] font-bold uppercase tracking-wide text-dim">
              {m.l}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
              <div className="h-full rounded" style={{ width: `${m.p}%`, background: m.c }} />
            </div>
            <div className="mt-1 text-xs text-dim">{m.p}% of members</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
