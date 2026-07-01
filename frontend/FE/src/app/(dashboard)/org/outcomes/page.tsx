"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/cards/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWeeklyReport } from "@/hooks/org/useWeeklyReport";
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

const getMondayOfDate = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getSundayOfDate = (d: Date): Date => {
  const monday = getMondayOfDate(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const isFutureWeek = (weekStart: Date): boolean => {
  const currentMon = getMondayOfDate(new Date());
  return weekStart > currentMon;
};

export default function OrgOutcomesPage() {
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined);
  const { data: report, isPending, isError, error } = useWeeklyReport(selectedWeek);

  const reportData = report?.reportData;

  // Calendar states
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const initial = selectedWeek ? new Date(selectedWeek) : new Date();
    initial.setDate(1);
    initial.setHours(0, 0, 0, 0);
    return initial;
  });
  const [hoveredWeekStart, setHoveredWeekStart] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Update currentMonth if selectedWeek changes
  useEffect(() => {
    if (selectedWeek) {
      const selectedDate = new Date(selectedWeek);
      setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [selectedWeek]);

  // Generate weeks for calendar grid (Monday-Sunday)
  const calendarWeeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const startDate = getMondayOfDate(firstDayOfMonth);
    const endDate = getSundayOfDate(lastDayOfMonth);
    
    const weeksList: Date[][] = [];
    let currentDay = new Date(startDate);
    
    while (currentDay <= endDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDay));
        currentDay.setDate(currentDay.getDate() + 1);
      }
      weeksList.push(week);
    }
    
    return weeksList;
  }, [currentMonth]);

  const monthLabel = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

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
          
          {/* Custom Weekly Calendar Picker */}
          <div className="relative" ref={calendarRef}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-mid">Select Week:</span>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between gap-2.5 rounded-lg border border-line bg-canvas px-4 py-2 text-xs font-bold text-ink transition-all hover:bg-card hover:shadow-sm"
              >
                <span>
                  {selectedWeek
                    ? getWeekLabel(
                        getMondayOfDate(new Date(selectedWeek)).toISOString(),
                        getSundayOfDate(new Date(selectedWeek)).toISOString()
                      )
                    : "📅 Current Week"}
                </span>
                <svg className={`h-3 w-3 text-dim shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {isOpen && (
              <div className="absolute right-0 mt-2 z-30 w-72 rounded-card border border-line bg-card p-4 shadow-soft animate-fadeIn select-none">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="p-1 rounded-md hover:bg-canvas text-dim hover:text-ink transition-colors font-bold text-xs"
                  >
                    ←
                  </button>
                  <span className="text-xs font-bold text-ink font-serif">{monthLabel}</span>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="p-1 rounded-md hover:bg-canvas text-dim hover:text-ink transition-colors font-bold text-xs"
                  >
                    →
                  </button>
                </div>

                {/* Calendar Grid */}
                <table style={{ width: "100%", borderCollapse: "collapse" }} className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <th
                          key={i}
                          style={{ padding: "6px 0", textAlign: "center", background: "none", borderBottom: "none" }}
                          className="pb-2 text-center text-[10px] font-bold text-dim uppercase tracking-wider w-8"
                        >
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarWeeks.map((week, wIdx) => {
                      const weekMonday = getMondayOfDate(week[0]);
                      const weekMondayStr = weekMonday.toISOString();
                      
                      const isSelected = selectedWeek 
                        ? getMondayOfDate(new Date(selectedWeek)).toISOString() === weekMondayStr
                        : getMondayOfDate(new Date()).toISOString() === weekMondayStr;

                      const isHovered = hoveredWeekStart === weekMondayStr;
                      const disabled = isFutureWeek(weekMonday);

                      return (
                        <tr
                          key={wIdx}
                          onMouseEnter={() => !disabled && setHoveredWeekStart(weekMondayStr)}
                          onMouseLeave={() => setHoveredWeekStart(null)}
                          className="group"
                        >
                          {week.map((day, dIdx) => {
                            const isToday = day.toDateString() === new Date().toDateString();
                            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();

                            return (
                              <td
                                key={dIdx}
                                onClick={() => {
                                  if (!disabled) {
                                    setSelectedWeek(weekMondayStr);
                                    setIsOpen(false);
                                  }
                                }}
                                style={{
                                  padding: "6px 0",
                                  textAlign: "center",
                                  borderBottom: "none",
                                  background: isSelected
                                    ? "rgba(78, 140, 88, 0.15)"
                                    : isHovered && !disabled
                                    ? "var(--bg-surface-2)"
                                    : "none"
                                }}
                                className={`text-xs transition-all relative select-none
                                  ${!isCurrentMonth ? "text-dim opacity-35" : "text-ink font-semibold"}
                                  ${disabled ? "cursor-not-allowed opacity-20 text-dim" : "cursor-pointer"}
                                  ${isSelected ? "text-sage font-bold" : ""}
                                  ${isHovered && !isSelected && !disabled ? "text-ink font-semibold" : ""}
                                  ${dIdx === 0 && isSelected ? "rounded-l-lg" : ""}
                                  ${dIdx === 6 && isSelected ? "rounded-r-lg" : ""}
                                  ${dIdx === 0 && isHovered && !isSelected && !disabled ? "rounded-l-lg" : ""}
                                  ${dIdx === 6 && isHovered && !isSelected && !disabled ? "rounded-r-lg" : ""}
                                `}
                              >
                                <div className={`h-6 w-6 mx-auto flex items-center justify-center rounded-full transition-all
                                  ${isToday ? "border border-sage text-sage font-bold" : ""}
                                  ${isSelected ? "bg-sage text-white shadow-sm" : ""}
                                `}>
                                  {day.getDate()}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {/* Reset button */}
                <div className="mt-3 pt-2.5 border-t border-line text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedWeek(undefined);
                      setIsOpen(false);
                    }}
                    className="text-[10px] font-bold text-sage hover:text-sage-mid transition-colors uppercase tracking-wider"
                  >
                    Reset to Current Week
                  </button>
                </div>
              </div>
            )}
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