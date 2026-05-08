"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { Badge } from "@/components/ui/Badge";
import moods from "@/mock/moods.json";
import type { MoodOption, MoodHistoryPoint } from "@/types/mood";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

const MOODS_DATA = moods.options as MoodOption[];
const MOOD_HISTORY = moods.history7 as MoodHistoryPoint[];

function moodColor(v: number) {
  return MOODS_DATA.find((m) => m.value === v)?.color ?? "#4E8C58";
}

export default function MoodMappingPage() {
  const [moodSel, setMoodSel] = useState<number | null>(null);
  const [moodLogged, setMoodLogged] = useState(false);
  const [range, setRange] = useState("30");

  const rand30 = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => {
        const h = 1 + ((i * 7 + 13) % 4) + 1;
        return h;
      }),
    []
  );

  const chartBars = MOOD_HISTORY.map((d) => (
    <div key={d.d} className="flex h-full flex-1 flex-col items-center gap-1.5">
      <div className="flex h-full w-full items-end">
        <div
          className="w-full rounded-t-[5px] opacity-85"
          style={{ height: `${(d.v / 5) * 100}%`, background: moodColor(d.v) }}
        />
      </div>
      <div className="text-[10.5px] font-semibold text-dim">{d.d}</div>
    </div>
  ));

  return (
    <DashboardLayout title="Mood Mapping">
      <div className="animate-fadeIn">
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
            {moodSel && !moodLogged ? (
              <div className="animate-fadeIn mt-3">
                <div className="mb-4">
                  <Label>What&apos;s contributing? (optional)</Label>
                  <Textarea rows={3} placeholder="Work stress, slept well, connected with a friend..." />
                </div>
                <Button fullWidth type="button" onClick={() => setMoodLogged(true)}>
                  Save Today&apos;s Mood
                </Button>
              </div>
            ) : null}
            {moodLogged ? (
              <div className="mt-3 flex animate-fadeIn items-center gap-2.5 rounded-[10px] bg-sage-tint px-4 py-3">
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
              <div className="mb-2 flex h-[90px] items-end gap-2">{chartBars}</div>
              <div className="mt-2.5 flex flex-wrap gap-3">
                {MOODS_DATA.map((m) => (
                  <div key={m.value} className="flex items-center gap-1">
                    <div
                      className="h-2 w-2 rounded-[2px]"
                      style={{ background: m.color }}
                    />
                    <span className="text-[11px] font-semibold text-dim">{m.label}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-dim">
                Insights
              </div>
              <div className="space-y-3 text-[13.5px] leading-relaxed">
                <div className="flex gap-2">
                  <span>📈</span>
                  <span>
                    Mood tends to <strong>improve mid-week</strong> — Thursdays show highest scores.
                  </span>
                </div>
                <div className="flex gap-2">
                  <span>💡</span>
                  <span>
                    You&apos;ve logged <strong>5 days in a row</strong>. Great consistency!
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-dim">
              30-Day History
            </div>
            <div className="w-[200px]">
              <Select
                options={[
                  { value: "30", label: "Last 30 days" },
                  { value: "60", label: "Last 60 days" },
                ]}
                value={range}
                onChange={setRange}
              />
            </div>
          </div>
          <div className="flex h-[70px] items-end gap-1">
            {rand30.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[3px] opacity-75"
                style={{ height: `${(h / 5) * 100}%`, background: moodColor(h) }}
              />
            ))}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
