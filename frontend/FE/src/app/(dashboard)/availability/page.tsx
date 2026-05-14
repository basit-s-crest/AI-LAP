"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { setOnDemand } from "@/store/slices/coachSlice";
import { cn } from "@/lib/cn";
import api from "@/lib/api";
import { AUTH_USER_JSON_KEY } from "@/constants/storage";
import { toast } from "sonner";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type DayName = typeof days[number];

type SlotEntry = {
  day: DayName;
  start: string;
  end: string;
  enabled: boolean;
};

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

const DEFAULT_SLOTS: SlotEntry[] = days.map((day) => ({
  day,
  start: "9:00 AM",
  end: "5:00 PM",
  enabled: ["Monday", "Tuesday", "Thursday", "Friday"].includes(day),
}));

/** Read the logged-in user's id from the azadi_user cookie. */
function getCoachIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const encoded = encodeURIComponent(AUTH_USER_JSON_KEY);
    const match = document.cookie.split("; ").find((r) => r.startsWith(`${encoded}=`));
    if (!match) return null;
    const raw = decodeURIComponent(match.split("=")[1]);
    const user = JSON.parse(raw) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

export default function AvailabilityPage() {
  const dispatch = useAppDispatch();
  const onDemand = useAppSelector((s) => s.coach.onDemand);

  const [slots, setSlots] = useState<SlotEntry[]>(DEFAULT_SLOTS);
  const [duration, setDuration] = useState("50");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved availability on mount
  useEffect(() => {
    const coachId = getCoachIdFromCookie();
    if (!coachId) return;

    api
      .get<{ slots: SlotEntry[]; duration: number }>(`/api/sessions/availability/${coachId}`)
      .then(({ data }) => {
        if (data.slots && data.slots.length > 0) {
          // Merge returned slots with defaults (in case new days were added)
          const map = Object.fromEntries(data.slots.map((s) => [s.day, s]));
          setSlots(
            days.map((day) =>
              map[day]
                ? { ...map[day], day }
                : { day, start: "9:00 AM", end: "5:00 PM", enabled: false }
            )
          );
          setDuration(String(data.duration ?? 50));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const updateSlot = (day: DayName, field: keyof SlotEntry, value: string | boolean) => {
    setSlots((prev) =>
      prev.map((s) => (s.day === day ? { ...s, [field]: value } : s))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch("/api/sessions/availability", {
        slots,
        duration: Number(duration),
      });
      toast.success("Availability saved");
    } catch {
      toast.error("Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title="Availability">
      <div className="max-w-[540px] animate-fadeIn space-y-4">
        <Card>
          <h3 className="mb-4 font-serif text-lg font-semibold">Weekly Availability</h3>
          {slots.map((slot) => {
            const on = slot.enabled;
            return (
              <div key={slot.day} className="mb-4 flex flex-wrap items-center gap-3">
                <div className="w-24 text-[13px] font-semibold">{slot.day}</div>
                <input
                  className={cn(
                    "w-[100px] rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] outline-none focus:border-sage",
                    !on && "opacity-40"
                  )}
                  disabled={!on}
                  value={slot.start}
                  onChange={(e) => updateSlot(slot.day, "start", e.target.value)}
                />
                <span className="text-sm text-dim">to</span>
                <input
                  className={cn(
                    "w-[100px] rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3 py-2 text-[13.5px] outline-none focus:border-sage",
                    !on && "opacity-40"
                  )}
                  disabled={!on}
                  value={slot.end}
                  onChange={(e) => updateSlot(slot.day, "end", e.target.value)}
                />
                <AvailabilityToggle
                  on={on}
                  onClick={() => updateSlot(slot.day, "enabled", !on)}
                />
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
              value={duration}
              onChange={setDuration}
            />
          </div>
          <Button type="button" className="mt-4" onClick={handleSave} disabled={saving || !loaded}>
            {saving ? "Saving…" : "Save Availability"}
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
