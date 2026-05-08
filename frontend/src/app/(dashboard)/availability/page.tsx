"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { setOnDemand } from "@/store/slices/coachSlice";
import { cn } from "@/lib/cn";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function AvailabilityToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative h-[22px] w-[38px] shrink-0 rounded-[11px] transition-colors",
        on ? "bg-sage" : "border-[1.5px] border-[rgba(60,50,40,0.2)] bg-[#EDE7DC]"
      )}
    >
      <div
        className={cn(
          "absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-[left]",
          on ? "left-[19px]" : "left-[3px]"
        )}
      />
    </button>
  );
}

export default function AvailabilityPage() {
  const dispatch = useAppDispatch();
  const onDemand = useAppSelector((s) => s.coach.onDemand);
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    Monday: true,
    Tuesday: true,
    Wednesday: false,
    Thursday: true,
    Friday: true,
    Saturday: false,
    Sunday: false,
  });

  return (
    <DashboardLayout title="Availability">
      <div className="max-w-[540px] animate-fadeIn space-y-4">
        <Card>
          <h3 className="mb-4 font-serif text-lg font-semibold">Weekly Availability</h3>
          {days.map((day) => {
            const on = toggles[day];
            return (
              <div key={day} className="mb-4 flex flex-wrap items-center gap-3">
                <div className="w-24 text-[13px] font-semibold">{day}</div>
                <input
                  className={cn(
                    "w-[100px] rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] outline-none focus:border-sage",
                    !on && "opacity-40"
                  )}
                  disabled={!on}
                  defaultValue={on ? "9:00 AM" : ""}
                />
                <span className="text-sm text-dim">to</span>
                <input
                  className={cn(
                    "w-[100px] rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] outline-none focus:border-sage",
                    !on && "opacity-40"
                  )}
                  disabled={!on}
                  defaultValue={on ? "5:00 PM" : ""}
                />
                <AvailabilityToggle on={on} onClick={() => setToggles((t) => ({ ...t, [day]: !t[day] }))} />
              </div>
            );
          })}
          <div className="mt-3">
            <Label>Session Duration</Label>
            <Select
              options={[
                { value: "50", label: "50 minutes" },
                { value: "30", label: "30 minutes" },
                { value: "25", label: "25 minutes" },
              ]}
              value="50"
              onChange={() => {}}
            />
          </div>
          <Button type="button" className="mt-4">
            Save Availability
          </Button>
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">On-Demand Settings</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">Available for on-demand sessions</div>
              <div className="text-xs text-dim">Users can request you immediately when active</div>
            </div>
            <AvailabilityToggle on={onDemand} onClick={() => dispatch(setOnDemand(!onDemand))} />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
