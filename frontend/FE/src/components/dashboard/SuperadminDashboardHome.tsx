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
    <div className="flex flex-col gap-6 anim-up">
      {/* Top Stats Row */}
      <div className="stat-grid sg-4">
        {/* Card 1: Total Users */}
        <div className="stat-card sc-sage">
          <div className="stat-label">Total Users</div>
          <div className="stat-value">{totalUsers}</div>
          <div className="stat-sub">{verifiedUsers} verified</div>
          <div className="stat-icon bg-sage">👥</div>
        </div>

        {/* Card 2: Active Coaches */}
        <div className="stat-card sc-teal">
          <div className="stat-label">Active Coaches</div>
          <div className="stat-value">{activeCoaches}</div>
          <div className="stat-sub">{coaches.length} total</div>
          <div className="stat-icon bg-teal">🧑‍⚕️</div>
        </div>

        {/* Card 3: Total Sessions */}
        <div className="stat-card sc-amber">
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-sub">booked across platform</div>
          <div className="stat-icon bg-amber">💬</div>
        </div>

        {/* Card 4: Pending Users */}
        <div className="stat-card sc-rose">
          <div className="stat-label">Pending Users</div>
          <div className="stat-value">{pendingUsers}</div>
          <div className="stat-sub">not verified</div>
          <div className="stat-icon bg-rose">⚠️</div>
        </div>
      </div>

      {/* Asymmetric Two-Column Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="serif text-lg text-ink">
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
                      ? "btn btn-xs active"
                      : "btn btn-xs"
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {chartLoading ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-ghost">
              Loading activity data...
            </div>
          ) : chartFormattedData.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center text-sm text-ghost">
              No activity data available for this period
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartFormattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(92,107,115,0.06)" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 11, fill: "#8D99AE" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "#8D99AE" }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(92,107,115,0.04)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      fontSize: 12,
                      backgroundColor: "#FFFFFF",
                      boxShadow: "var(--shadow-md)"
                    }}
                  />
                  <Legend 
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ fontSize: 12 }}
                    iconType="circle"
                  />
                  <Bar dataKey="Users" fill="#68A688" radius={[3, 3, 0, 0]} opacity={0.9} barSize={6} />
                  <Bar dataKey="Coaches" fill="#53A4D0" radius={[3, 3, 0, 0]} opacity={0.9} barSize={6} />
                  <Bar dataKey="Organizations" fill="#FF8D69" radius={[3, 3, 0, 0]} opacity={0.9} barSize={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-label">Live Activity</div>
          <div className="flex flex-col gap-4">
            {activity.slice(0, 5).map((a, i) => (
              <div key={a.id ?? `activity-${i}`} className="activity-item">
                <div className="a-icon bg-white text-lg border border-[#D2DBE3] shadow-sm">
                  {a.type === "alert" ? "⚠️" : a.type === "moderation" ? "💬" : a.type === "join" ? "🧑‍🤝‍🧑" : a.type === "session" ? "📅" : "🆕"}
                </div>
                <div className="a-body">
                  <span dangerouslySetInnerHTML={{ __html: a.html }} />
                  <div className="a-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row of Grids */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Mood Distribution */}
        <div className="card">
          <div className="section-label">Mood Distribution</div>
          {moodRows.map(([l, p, c]) => (
            <div key={String(l)} className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <div className="text-sm font-semibold">{l}</div>
                <div className="text-xs text-soft font-bold">{Math.round(Number(p) * 100)}%</div>
              </div>
              <div className="progress" style={{ height: "6px" }}>
                <div
                  className="progress-fill"
                  style={{ width: `${Number(p) * 100}%`, background: c as string }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Top Groups */}
        <div className="card">
          <div className="section-label">Top Groups by Activity</div>
          <div className="flex flex-col gap-3">
            {topGroups.map((g) => (
              <div key={g.id} className="flex items-center justify-between py-1.5 border-b border-[#D2DBE3] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{g.emoji}</span>
                  <span className="text-sm font-bold text-ink">{g.name}</span>
                </div>
                <span className="text-xs font-semibold text-ghost">{g.postCount} posts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Client Orgs */}
        <div className="card">
          <div className="section-label">Client Orgs</div>
          <div className="flex flex-col gap-3">
            {orgs.map((o) => (
              <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-[#D2DBE3] last:border-0">
                <div>
                  <div className="text-sm font-bold text-ink">{o.name}</div>
                  <div className="text-xs text-soft">{o.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-sage">{o.users} users</div>
                  <div className="text-[10px] text-ghost font-semibold uppercase">{o.plan}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
