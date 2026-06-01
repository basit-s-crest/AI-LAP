"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { ActivityCardRow } from "@/components/cards/ActivityCard";
import {
  useActivityQuery,
  useAdminOverviewStatsQuery,
  useMoodDistributionQuery,
  useActivityChartQuery,
} from "@/hooks/api/use-admin";
import { useOrganizationsQuery } from "@/hooks/api/use-organizations";
import { useAdminCoaches } from "@/hooks/admin/useAdminCoaches";
import { useAdminGroups } from "@/hooks/admin/useAdminGroups";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CHART_RANGE_OPTIONS = [
  { label: "7D", days: 7 as const },
  { label: "15D", days: 15 as const },
  { label: "30D", days: 30 as const },
] as const;

export function SuperadminDashboardHome() {
  const { data: activity = [] } = useActivityQuery();
  const { data: overviewStats } = useAdminOverviewStatsQuery();
  const { data: orgs = [] } = useOrganizationsQuery();
  const { data: users = [] } = useAdminUsers();
  const { data: coaches = [] } = useAdminCoaches();
  const { data: groups = [] } = useAdminGroups();
  const { data: moodApi } = useMoodDistributionQuery();

  const [chartDays, setChartDays] = useState<7 | 15 | 30>(30);
  const { data: chartData = [], isLoading: chartLoading } = useActivityChartQuery(chartDays);

  const chartFormattedData = useMemo(() => {
    console.log('[SuperadminDashboard] Raw chart data:', chartData);
    const formatted = chartData.map((d) => ({
      label: formatShortDate(new Date(d.date)),
      Users: d.users,
      Coaches: d.coaches,
      Organizations: d.orgs,
    }));
    console.log('[SuperadminDashboard] Formatted chart data:', formatted);
    return formatted;
  }, [chartData]);

  const moodRows = useMemo(() => {
    const g = moodApi?.great ?? 0;
    const good = moodApi?.good ?? 0;
    const okay = moodApi?.okay ?? 0;
    const low = moodApi?.low ?? 0;
    const struggling = moodApi?.struggling ?? 0;
    const total = g + good + okay + low + struggling;
    const p = (n: number) => (total > 0 ? n / total : 0);
    return [
      ["😊 Great", p(g), "#4E8C58"],
      ["🙂 Good", p(good), "#7AB882"],
      ["😐 Okay", p(okay), "#B8832A"],
      ["😟 Low", p(low), "#B35A38"],
      ["😔 Struggling", p(struggling), "#C0392B"],
    ] as const;
  }, [moodApi]);

  const topGroups = useMemo(
    () => [...groups].sort((a, b) => b.postCount - a.postCount).slice(0, 5),
    [groups]
  );

  const verifiedUsers = users.filter((user) => user.isVerified).length;
  const activeCoaches =
    overviewStats?.activeCoaches ?? coaches.filter((coach) => coach.isActive).length;
  const pendingUsers = overviewStats?.pendingUsers ?? users.length - verifiedUsers;
  const totalUsers = overviewStats?.totalUsers ?? users.length;
  const totalSessions = overviewStats?.totalSessions ?? 0;

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Total Users"
          value={String(totalUsers)}
          sub={`${verifiedUsers} verified`}
          accent="sage"
        />
        <StatsCard
          label="Active Coaches"
          value={String(activeCoaches)}
          sub={`${coaches.length} total`}
          accent="blue"
        />
        <StatsCard
          label="Total Sessions"
          value={String(totalSessions)}
          sub="booked across platform"
          accent="gold"
        />
        <StatsCard
          label="Pending Users"
          value={String(pendingUsers)}
          sub="not verified"
          accent="red"
        />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-semibold">
              Platform Activity — {chartDays} Days
            </h3>
            <div className="flex gap-2">
              {CHART_RANGE_OPTIONS.map(({ label, days }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setChartDays(days)}
                  className={
                    chartDays === days
                      ? "rounded-md border border-sage px-2 py-1 text-[11.5px] font-semibold text-sage"
                      : "rounded-md border border-[rgba(60,50,40,0.12)] px-2 py-1 text-[11.5px] font-semibold text-mid"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {chartLoading ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-dim">
              Loading activity data...
            </div>
          ) : chartFormattedData.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-dim">
              No activity data available for this period
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartFormattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,50,40,0.06)" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: "#9C8E7E" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "#9C8E7E" }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(60,50,40,0.04)" }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(60,50,40,0.12)",
                      fontSize: 12,
                      backgroundColor: "#FDFAF5",
                    }}
                  />
                  <Legend 
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12 }}
                    iconType="circle"
                  />
                  <Bar dataKey="Users" fill="#4E8C58" radius={[3, 3, 0, 0]} opacity={0.9} barSize={6} />
                  <Bar dataKey="Coaches" fill="#3A6E99" radius={[3, 3, 0, 0]} opacity={0.9} barSize={6} />
                  <Bar dataKey="Organizations" fill="#B8832A" radius={[3, 3, 0, 0]} opacity={0.9} barSize={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Live Activity</h3>
          {activity.slice(0, 5).map((a, i) => (
            <ActivityCardRow key={a.id ?? `activity-${i}`} {...a} />
          ))}
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
            Mood Distribution
          </div>
          {moodRows.map(([l, p, c]) => (
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
              <span className="font-mono text-xs text-mid">{g.postCount} posts</span>
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
