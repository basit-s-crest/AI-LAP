"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWeeklyReport, useAvailableWeeks } from "@/hooks/org/useWeeklyReport";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getWeekLabel(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export default function OrgOutcomesPage() {
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined);
  const { data: report, isPending, isError, error } = useWeeklyReport(selectedWeek);
  const { data: availableWeeks = [] } = useAvailableWeeks();

  const reportData = report?.reportData;

  const moodChartData = useMemo(() => {
    if (!reportData) return [];
    const dist = reportData.mentalHealth.moodDistribution;
    return [
      { mood: "😊 Great", count: dist.GREAT, fill: "#4E8C58" },
      { mood: "🙂 Good", count: dist.GOOD, fill: "#7AB882" },
      { mood: "😐 Okay", count: dist.OKAY, fill: "#B8832A" },
      { mood: "😟 Low", count: dist.LOW, fill: "#B35A38" },
      { mood: "😔 Struggling", count: dist.HARD, fill: "#C0392B" },
    ];
  }, [reportData]);

  const phqScoreCategory = (score: number | null) => {
    if (score === null) return "—";
    if (score < 5) return "Minimal";
    if (score < 10) return "Mild";
    if (score < 15) return "Moderate";
    if (score < 20) return "Moderately Severe";
    return "Severe";
  };

  const gadScoreCategory = (score: number | null) => {
    if (score === null) return "—";
    if (score < 5) return "Minimal";
    if (score < 10) return "Mild";
    if (score < 15) return "Moderate";
    return "Severe";
  };

  return (
    <DashboardLayout title="Outcomes & Reports">
      {/* Week Selector */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-semibold">Weekly Report</h3>
            <p className="text-sm text-dim">
              {reportData
                ? getWeekLabel(reportData.weekStartDate, reportData.weekEndDate)
                : "Current Week"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="week-selector" className="text-sm text-mid">
              Select Week:
            </label>
            <select
              id="week-selector"
              value={selectedWeek || "current"}
              onChange={(e) => setSelectedWeek(e.target.value === "current" ? undefined : e.target.value)}
              className="rounded-md border border-line bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sage"
            >
              <option value="current">Current Week</option>
              {availableWeeks.map((week) => (
                <option key={week.weekStartDate} value={week.weekStartDate}>
                  {getWeekLabel(week.weekStartDate, week.weekEndDate)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[var(--bg-surface-2)]"
            />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-sm text-danger">{error.message || "Failed to load report"}</Card>
      ) : reportData ? (
        <div className="anim-up space-y-6">
          {/* Executive Summary */}
          <Card>
            <h3 className="mb-4 font-serif text-lg font-semibold">📊 Executive Summary</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatsCard
                label="Total Members"
                value={String(reportData.summary.totalMembers)}
                sub={`${reportData.summary.newMembers} new this week`}
                accent="sage"
              />
              <StatsCard
                label="Active Members"
                value={String(reportData.summary.activeMembers)}
                sub={`${reportData.summary.engagementRate}% engagement`}
                accent="blue"
              />
              <StatsCard
                label="Sessions Completed"
                value={String(reportData.summary.sessionsCompleted)}
                sub="this week"
                accent="gold"
              />
              <StatsCard
                label="Crisis Alerts"
                value={String(reportData.summary.crisisAlerts)}
                sub="flagged posts"
                accent="red"
              />
            </div>
          </Card>

          {/* Mental Health Outcomes */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-serif text-lg font-semibold">🧠 Mental Health Outcomes</h3>
              <div className="space-y-4">
                <div className="rounded-lg bg-[var(--bg-surface-2)] p-4">
                  <div className="text-sm font-semibold text-dim">PHQ-8 (Depression)</div>
                  <div className="mt-1 font-serif text-3xl font-bold text-ink">
                    {reportData.mentalHealth.avgPhqScore ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-mid">
                    {phqScoreCategory(reportData.mentalHealth.avgPhqScore)} severity
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-surface-2)] p-4">
                  <div className="text-sm font-semibold text-dim">GAD-7 (Anxiety)</div>
                  <div className="mt-1 font-serif text-3xl font-bold text-ink">
                    {reportData.mentalHealth.avgGadScore ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-mid">
                    {gadScoreCategory(reportData.mentalHealth.avgGadScore)} severity
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-surface-2)] p-4">
                  <div className="text-sm font-semibold text-dim">Mood Check-ins</div>
                  <div className="mt-1 font-serif text-3xl font-bold text-ink">
                    {reportData.mentalHealth.moodEntries}
                  </div>
                  <div className="mt-1 text-xs text-mid">entries this week</div>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 font-serif text-lg font-semibold">😊 Mood Distribution</h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={moodChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,50,40,0.06)" />
                    <XAxis
                      dataKey="mood"
                      tick={{ fontSize: 11, fill: "#9C8E7E" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9C8E7E" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(60,50,40,0.04)" }}
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                        backgroundColor: "var(--bg-surface)",
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Member Engagement */}
          <Card>
            <h3 className="mb-4 font-serif text-lg font-semibold">👥 Member Engagement</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-[var(--bg-surface-2)] p-4 text-center">
                <div className="font-serif text-4xl font-bold text-sage">
                  {reportData.community.groupPosts}
                </div>
                <div className="mt-2 text-sm font-semibold text-dim">Community Posts</div>
                <div className="text-xs text-mid">shared in peer groups</div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-2)] p-4 text-center">
                <div className="font-serif text-4xl font-bold text-blue">
                  {reportData.community.groupMembers}
                </div>
                <div className="mt-2 text-sm font-semibold text-dim">Group Memberships</div>
                <div className="text-xs text-mid">active participants</div>
              </div>
              <div className="rounded-lg bg-[var(--bg-surface-2)] p-4 text-center">
                <div className="font-serif text-4xl font-bold text-gold">
                  {reportData.community.coachMessages}
                </div>
                <div className="mt-2 text-sm font-semibold text-dim">Coach Messages</div>
                <div className="text-xs text-mid">1-on-1 conversations</div>
              </div>
            </div>
          </Card>

          {/* Coach Activity */}
          <Card>
            <h3 className="mb-4 font-serif text-lg font-semibold">💼 Top Active Coaches</h3>
            {reportData.coaches.topActiveCoaches.length === 0 ? (
              <p className="text-sm text-dim">No coach activity this week</p>
            ) : (
              <div className="space-y-3">
                {reportData.coaches.topActiveCoaches.map((coach, idx) => (
                  <div
                    key={coach.id}
                    className="flex items-center justify-between rounded-lg bg-[var(--bg-surface-2)] p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sage/10 font-serif text-sm font-bold text-sage">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-ink">{coach.name}</div>
                        {coach.speciality && (
                          <div className="text-xs text-dim">{coach.speciality}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-bold text-mid">
                        {coach.messageCount}
                      </div>
                      <div className="text-xs text-dim">messages</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Download Report */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-semibold">📥 Download Report</h3>
                <p className="text-sm text-dim">
                  Export this week's report as PDF for your records
                </p>
              </div>
              <Button type="button" variant="primary" size="md">
                Download PDF
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
    </DashboardLayout>
  );
}