"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import moods from "@/mock/moods.json";
import type { MoodOption } from "@/types/mood";
import { MoodValue, MoodTrendRecord } from "@/services/mood.service";
import { useMoodTrend, useSubmitMood } from "@/hooks/api/use-mood";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { markRead } from "@/store/slices/notificationSlice";
import { markNotificationRead } from "@/lib/notificationReadStore";
import { localTodayKey } from "@/hooks/useNotifications";

const MOODS_DATA = moods.options as MoodOption[];

const MOOD_MAP: Record<number, MoodValue> = {
  5: "GREAT",
  4: "GOOD",
  3: "OKAY",
  2: "LOW",
  1: "HARD",
};

function moodColor(value: number) {
  return MOODS_DATA.find((m) => m.value === value)?.color ?? "#4E8C58";
}

function moodLabelFromValue(value: MoodValue) {
  return MOODS_DATA.find((m) => m.label.toUpperCase() === value)?.label ?? value;
}

function moodEmojiFromValue(value: MoodValue) {
  return MOODS_DATA.find((m) => m.label.toUpperCase() === value)?.emoji ?? "🙂";
}

function moodColorFromMood(value: MoodValue) {
  const found = MOODS_DATA.find((m) => m.label.toUpperCase() === value);
  return found?.color ?? "#4E8C58";
}

function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function scoreFromMood(mood: MoodValue) {
  switch (mood) {
    case "GREAT":
      return 5;
    case "GOOD":
      return 4;
    case "OKAY":
      return 3;
    case "LOW":
      return 2;
    case "HARD":
      return 1;
    default:
      return 3;
  }
}

function buildInsightText(records: MoodTrendRecord[]) {
  if (!records.length) {
    return {
      main: "No mood data yet for this range.",
      secondary: "Log a few days and the chart will populate automatically.",
    };
  }

  const average = records.reduce((sum, item) => sum + item.score, 0) / records.length;
  const bestDay = [...records].sort((a, b) => b.score - a.score)[0];
  const frequent = records.reduce<Record<MoodValue, number>>(
    (acc, curr) => {
      acc[curr.mood] += 1;
      return acc;
    },
    { GREAT: 0, GOOD: 0, OKAY: 0, LOW: 0, HARD: 0 }
  );

  const mostFrequent = (Object.entries(frequent).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "OKAY") as MoodValue;

  return {
    main: `Average mood is ${average.toFixed(2)} / 5. Most frequent mood: ${moodLabelFromValue(
      mostFrequent
    )}.`,
    secondary: `Best day in this range was ${bestDay.date} with ${moodLabelFromValue(
      bestDay.mood
    )}.`,
  };
}

export default function MoodMappingPage() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [moodSel, setMoodSel] = useState<number | null>(null);
  const [moodLogged, setMoodLogged] = useState(false);
  const [moodComment, setMoodComment] = useState("");
  const [range, setRange] = useState<7 | 30 | 60>(30);

  const submitMoodMutation = useSubmitMood();
  const weekTrendQuery = useMoodTrend(7);
  const selectedTrendQuery = useMoodTrend(range);

  const weekRecords = weekTrendQuery.data?.records ?? [];
  const selectedRecords = selectedTrendQuery.data?.records ?? [];

  const weekInsights = useMemo(() => buildInsightText(weekRecords), [weekRecords]);
  const selectedInsights = useMemo(() => buildInsightText(selectedRecords), [selectedRecords]);

  const handleSaveMood = async () => {
    if (!moodSel) return;

    try {
      await submitMoodMutation.mutateAsync(MOOD_MAP[moodSel]);
      setMoodLogged(true);
      const moodNotifId = `mood-reminder-${localTodayKey()}`;
      if (userId) markNotificationRead(userId, moodNotifId);
      dispatch(markRead(moodNotifId));
    } catch {
      setMoodLogged(false);
    }
  };

  return (
    <DashboardLayout title="Mood Mapping">
      <div className="anim-up">
        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">
              Daily Check-in
            </div>
            <div className="mb-3 font-serif text-[22px] font-semibold text-ink">
              How are you feeling today?
            </div>

            <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {MOODS_DATA.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    setMoodSel(m.value);
                    setMoodLogged(false);
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 border-[rgba(60,50,40,0.12)] bg-card p-4 text-[26px] transition-all hover:-translate-y-0.5 hover:border-[rgba(60,50,40,0.22)] hover:shadow-[0_4px_16px_rgba(60,50,40,0.1)]",
                    moodSel === m.value && "border-sage bg-sage-soft shadow-sm"
                  )}
                  style={
                    moodSel === m.value
                      ? { borderColor: m.color, background: `${m.color}18` }
                      : undefined
                  }
                >
                  {m.emoji}
                  <span
                    className={cn(
                      "text-[11px] font-semibold text-mid",
                      moodSel === m.value && "text-sage"
                    )}
                  >
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            {!moodLogged ? (
              <div className="anim-up mt-3">
                <div className="mb-4">
                  <Label>What&apos;s contributing? (optional)</Label>
                  <Textarea
                    rows={3}
                    value={moodComment}
                    onChange={(e) => setMoodComment(e.target.value)}
                    placeholder="Work stress, slept well, connected with a friend..."
                  />
                </div>

                <Button
                  fullWidth
                  type="button"
                  onClick={handleSaveMood}
                  disabled={!moodSel || submitMoodMutation.isPending}
                >
                  {submitMoodMutation.isPending ? "Saving..." : "Save Today's Mood"}
                </Button>

                {submitMoodMutation.isError ? (
                  <div className="mt-3 text-sm text-red-600">
                    Failed to save mood. Please try again.
                  </div>
                ) : null}
              </div>
            ) : null}

            {moodLogged ? (
              <div className="mt-3 flex anim-up items-center gap-2.5 rounded-[10px] bg-sage-tint px-4 py-3">
                <span className="text-lg text-sage">✓</span>
                <div>
                  <div className="text-sm font-semibold">Mood logged!</div>
                  <div className="text-sm text-mid">Your coach can see this.</div>
                </div>
              </div>
            ) : null}
          </Card>

          <div>
            <Card className="mb-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-wide text-dim">
                  7-Day Trend
                </div>
                <Badge variant="sage">This Week</Badge>
              </div>

              {weekTrendQuery.isLoading ? (
                <div className="flex h-[130px] items-center justify-center text-sm text-dim">
                  Loading trend...
                </div>
              ) : weekRecords.length ? (
                <>
                  <div className="mb-2 flex h-[130px] items-end gap-2 overflow-x-auto pb-1">
                    {weekRecords.map((d) => (
                      <div key={d.date} className="flex h-full min-w-[28px] flex-col items-center gap-1.5">
                        <div className="flex h-full w-full items-end">
                          <div
                            className="w-full rounded-t-[5px] opacity-85"
                            style={{
                              height: `${(scoreFromMood(d.mood) / 5) * 100}%`,
                              background: moodColorFromMood(d.mood),
                            }}
                          />
                        </div>
                        <div className="text-[10.5px] font-semibold text-dim">
                          {formatDay(d.date)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-3">
                    {MOODS_DATA.map((m) => (
                      <div key={m.value} className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-[2px]" style={{ background: m.color }} />
                        <span className="text-[11px] font-semibold text-dim">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-[130px] items-center justify-center text-sm text-dim">
                  No mood entries found in the last 7 days.
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">
                Insights
              </div>
              <div className="space-y-3 text-[13.5px] leading-relaxed">
                <div className="flex gap-2">
                  <span>📈</span>
                  <span>{weekInsights.main}</span>
                </div>
                <div className="flex gap-2">
                  <span>💡</span>
                  <span>{weekInsights.secondary}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-dim">
              Tracked History
            </div>

            <div className="w-[220px]">
              <Select
                options={[
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                  { value: "60", label: "Last 60 days" },
                ]}
                value={String(range)}
                onChange={(value) => setRange(Number(value) as 7 | 30 | 60)}
              />
            </div>
          </div>

          {selectedTrendQuery.isLoading ? (
            <div className="flex h-[110px] items-center justify-center text-sm text-dim">
              Loading history...
            </div>
          ) : selectedRecords.length ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[12px] bg-[var(--bg-surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-dim">Tracked days</div>
                  <div className="mt-1 text-lg font-semibold">{selectedTrendQuery.data?.totalTracked ?? 0}</div>
                </div>

                <div className="rounded-[12px] bg-[var(--bg-surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-dim">Average mood</div>
                  <div className="mt-1 text-lg font-semibold">{selectedTrendQuery.data?.averageMood ?? 0}</div>
                </div>

                <div className="rounded-[12px] bg-[var(--bg-surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-dim">Most frequent</div>
                  <div className="mt-1 text-lg font-semibold">
                    {selectedTrendQuery.data?.mostFrequentMood
                      ? moodLabelFromValue(selectedTrendQuery.data.mostFrequentMood)
                      : "—"}
                  </div>
                </div>

                <div className="rounded-[12px] bg-[var(--bg-surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wide text-dim">Consistency</div>
                  <div className="mt-1 text-lg font-semibold">
                    {selectedTrendQuery.data?.consistency ?? 0}%
                  </div>
                </div>
              </div>

              <div className="flex h-[120px] items-end gap-1 overflow-x-auto pb-1">
                {selectedRecords.map((d) => (
                  <div key={d.date} className="flex min-w-[16px] flex-1 flex-col items-center gap-1">
                    <div className="flex h-full w-full items-end">
                      <div
                        className="w-full rounded-t-[3px] opacity-75"
                        style={{
                          height: `${(d.score / 5) * 100}%`,
                          background: moodColorFromMood(d.mood),
                        }}
                      />
                    </div>
                    <div className="text-[10px] font-semibold text-dim">
                      {new Date(`${d.date}T00:00:00`).getDate()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-sm text-mid">
                {selectedInsights.main}
              </div>
            </>
          ) : (
            <div className="flex h-[110px] items-center justify-center text-sm text-dim">
              No tracked mood data found for this range.
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}