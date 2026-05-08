"use client";

import { Card } from "@/components/ui/Card";
import { StatsCard } from "@/components/cards/StatsCard";
import { SessionCardRow } from "@/components/cards/SessionCard";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { setOnDemand } from "@/store/slices/coachSlice";
import { cn } from "@/lib/cn";

const schedule = [
  { t: "9:00 AM", name: "Amara Johnson", type: "Weekly Check-in", status: "confirmed" as const },
  { t: "11:30 AM", name: "Marcus Thompson", type: "Initial Session", status: "confirmed" as const },
  { t: "2:00 PM", name: "Sofia Reyes", type: "Follow-up", status: "pending" as const },
  { t: "4:00 PM", name: "Open Slot", type: "On-demand available", status: "open" as const },
];

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      className={cn(
        "relative h-[22px] w-[38px] cursor-pointer rounded-[11px] transition-colors",
        on ? "bg-sage" : "border-[1.5px] border-[rgba(60,50,40,0.2)] bg-[#EDE7DC]"
      )}
    >
      <div
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-[left]",
          on ? "left-[19px]" : "left-[3px]"
        )}
      />
    </div>
  );
}

export function CoachDashboardHome() {
  const dispatch = useAppDispatch();
  const onDemand = useAppSelector((s) => s.coach.onDemand);

  return (
    <div className="animate-fadeIn">
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard label="Active Clients" value="18" sub="+2 this month" accent="blue" />
        <StatsCard label="Sessions (Feb)" value="34" trend="↑ 6 vs Jan" trendUp accent="sage" />
        <StatsCard label="Avg Rating" value="4.9" sub="⭐ Last 30 days" accent="gold" />
        <StatsCard label="AI Flagged" value="1" sub="Review needed" accent="red" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Today&apos;s Schedule</h3>
          {schedule.map((s) => (
            <SessionCardRow
              key={`${s.t}-${s.name}`}
              time={s.t}
              name={s.name}
              type={s.type}
              status={s.status}
            />
          ))}
        </Card>
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 font-serif text-lg font-semibold">AI Client Insights</h3>
            <div className="mb-3 flex gap-3 rounded-[10px] bg-danger-soft p-3">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="text-sm font-semibold">Jordan Wells</div>
                <div className="text-xs text-mid">Low mood trend — 5 consecutive days below 2</div>
              </div>
            </div>
            <div className="flex gap-3 rounded-[10px] bg-sage-tint p-3">
              <span className="text-lg">✓</span>
              <div>
                <div className="text-sm font-semibold">Amara Johnson</div>
                <div className="text-xs text-mid">Mood improving — up 0.8 points this week</div>
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="mb-2 font-serif text-lg font-semibold">On-Demand Status</h3>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Available for sessions</div>
                <div className="text-xs text-dim">Members can reach you now</div>
              </div>
              <button type="button" onClick={() => dispatch(setOnDemand(!onDemand))}>
                <Toggle on={onDemand} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
