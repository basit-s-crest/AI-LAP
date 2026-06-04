"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card } from "@/components/ui/Card";

export default function OutcomesPage() {
  return (
    <DashboardLayout title="Outcomes & Reports">
      <div className="anim-up">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard label="PHQ-8 Improvement" value="-1.4" sub="Average reduction vs baseline" accent="sage" />
          <StatsCard label="GAD-7 Improvement" value="-0.9" sub="Average reduction vs baseline" accent="teal" />
          <StatsCard label="Retention Rate" value="79.5%" sub="30-day active users" accent="amber" />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 serif text-lg font-semibold text-ink">PHQ-8 Score Distribution</h3>
            {[
              ["Minimal (0-4)", 18, "var(--sage)"],
              ["Mild (5-9)", 42, "var(--teal)"],
              ["Moderate (10-14)", 28, "var(--amber)"],
              ["Mod. Severe (15-19)", 9, "var(--rose)"],
              ["Severe (20+)", 3, "var(--plum)"],
            ].map(([l, p, c]) => (
              <div key={String(l)} className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-sm text-ink">{l}</div>
                  <div className="font-mono text-xs text-mid">{p}%</div>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-[var(--bg-surface-2)]">
                  <div className="h-full rounded" style={{ width: `${p}%`, background: c as string }} />
                </div>
              </div>
            ))}
          </Card>
          <Card>
            <h3 className="mb-3 serif text-lg font-semibold text-ink">Key Metrics</h3>
            {[
              { l: "Members with 3+ sessions", v: "61%" },
              { l: "Avg sessions per member", v: "2.8" },
              { l: "Coach satisfaction rating", v: "4.8 / 5" },
              { l: "Crisis escalations", v: "0" },
              { l: "Members who joined a group", v: "78%" },
            ].map((m) => (
              <div
                key={m.l}
                className="flex items-center justify-between border-b border-line py-2.5 last:border-b-0"
              >
                <div className="text-sm text-ink">{m.l}</div>
                <div className="font-mono font-bold text-sage">{m.v}</div>
              </div>
            ))}
          </Card>
        </div>
        <Card>
          <h3 className="mb-4 serif text-lg font-semibold text-ink">Download Reports</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { e: "📊", t: "Monthly Outcomes Report", d: "Mar 2026 · PDF" },
              { e: "📋", t: "Member Engagement Summary", d: "Q1 2026 · Excel" },
              { e: "🔒", t: "HIPAA Compliance Report", d: "Annual · PDF" },
            ].map((r) => (
              <Card key={r.t} variant="sm" hoverable className="cursor-pointer">
                <div className="mb-2 text-[28px]">{r.e}</div>
                <div className="mb-1 text-sm font-semibold text-ink">{r.t}</div>
                <div className="text-xs text-dim">{r.d}</div>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
