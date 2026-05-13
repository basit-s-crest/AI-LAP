"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function OrgOutcomesPage() {
  return (
    <DashboardLayout title="Outcomes & Reports">
      <div className="animate-fadeIn">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="PHQ-8 Improvement" value="-1.4" sub="avg reduction vs baseline" accent="sage" />
          <StatsCard label="GAD-7 Improvement" value="-0.9" sub="avg reduction vs baseline" accent="blue" />
          <StatsCard label="Retention Rate" value="79.5%" sub="30-day active users" accent="gold" />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-serif text-lg font-semibold">PHQ-8 Score Distribution</h3>
            {[
              ["Minimal (0-4)", 18, "#4E8C58"],
              ["Mild (5-9)", 42, "#7AB882"],
              ["Moderate (10-14)", 28, "#B8832A"],
              ["Mod. Severe (15-19)", 9, "#B35A38"],
              ["Severe (20+)", 3, "#C0392B"],
            ].map(([label, percent, color]) => (
              <div key={String(label)} className="mb-3">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{label}</span>
                  <span className="font-mono text-xs text-mid">{percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
                  <div className="h-full rounded" style={{ width: `${percent}%`, background: String(color) }} />
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <h3 className="mb-3 font-serif text-lg font-semibold">Key Metrics</h3>
            <ul className="space-y-2 text-sm text-mid">
              <li>Members with 3+ sessions: 61%</li>
              <li>Avg sessions per member: 2.8</li>
              <li>Coach satisfaction rating: 4.8 / 5</li>
              <li>Crisis escalations: 0</li>
              <li>Members who joined a group: 78%</li>
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
    </DashboardLayout>
  );
}
