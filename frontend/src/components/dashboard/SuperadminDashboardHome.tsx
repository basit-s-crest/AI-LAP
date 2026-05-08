"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { ActivityCardRow } from "@/components/cards/ActivityCard";
import { useActivityQuery } from "@/hooks/api/use-admin";
import { useOrganizationsQuery } from "@/hooks/api/use-organizations";
import groups from "@/mock/groups.json";
import type { CommunityGroup } from "@/types/group";

const chartData = [
  42, 55, 38, 61, 73, 58, 80, 65, 90, 72, 85, 88, 94, 78, 102, 96, 88, 105, 112, 98, 120, 108,
  115, 122, 130, 118, 142, 135, 128, 140,
];

export function SuperadminDashboardHome() {
  const { data: activity = [] } = useActivityQuery();
  const { data: orgs = [] } = useOrganizationsQuery();

  const bars = useMemo(() => {
    const max = Math.max(...chartData);
    return chartData.map((v) => ({ v, h: (v / max) * 100 }));
  }, []);

  const topGroups = useMemo(
    () => [...(groups as CommunityGroup[])].sort((a, b) => b.posts - a.posts).slice(0, 5),
    []
  );

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Total Users" value="1,714" trend="↑ 8.4% this month" trendUp accent="sage" />
        <StatsCard label="Active Coaches" value="5" sub="2 on-demand now" accent="blue" />
        <StatsCard label="Sessions This Month" value="342" trend="↑ 12% vs last month" trendUp accent="gold" />
        <StatsCard label="Flagged Users" value="1" sub="Requires attention" accent="red" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-semibold">Platform Activity — 30 Days</h3>
            <div className="flex gap-2">
              {["7D", "30D", "90D"].map((t, i) => (
                <button
                  key={t}
                  type="button"
                  className={
                    i === 1
                      ? "rounded-md border border-sage px-2 py-1 text-[11.5px] font-semibold text-sage"
                      : "rounded-md border border-[rgba(60,50,40,0.12)] px-2 py-1 text-[11.5px] font-semibold text-mid"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-[110px] items-end gap-0.5">
            {bars.map((b, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-sage opacity-80"
                style={{ height: `${b.h}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-dim">
            {["Feb 9", "Feb 16", "Feb 23", "Mar 1", "Mar 8"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Live Activity</h3>
          {activity.slice(0, 5).map((a, i) => (
            <ActivityCardRow key={i} {...a} />
          ))}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Mood Distribution
          </div>
          {[
            ["😊 Great", 0.28, "#4E8C58"],
            ["🙂 Good", 0.35, "#7AB882"],
            ["😐 Okay", 0.22, "#B8832A"],
            ["😟 Low", 0.1, "#B35A38"],
            ["😔 Struggling", 0.05, "#C0392B"],
          ].map(([l, p, c]) => (
            <div key={String(l)} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm">{l}</div>
                <div className="font-mono text-xs text-mid">{Math.round(Number(p) * 100)}%</div>
              </div>
              <div className="h-1.5 overflow-hidden rounded bg-[#EDE7DC]">
                <div
                  className="h-full rounded"
                  style={{ width: `${Number(p) * 100}%`, background: c as string }}
                />
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Top Groups by Activity
          </div>
          {topGroups.map((g) => (
            <div key={g.id} className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{g.emoji}</span>
                <span className="text-sm font-semibold">{g.name}</span>
              </div>
              <span className="font-mono text-xs text-mid">{g.posts} posts</span>
            </div>
          ))}
        </Card>
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Client Orgs
          </div>
          {orgs.map((o) => (
            <div key={o.id} className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{o.name}</div>
                <div className="text-xs text-dim">{o.type}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-sage">{o.users}</div>
                <div className="text-xs text-dim">{o.plan}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
