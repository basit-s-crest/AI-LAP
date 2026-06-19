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
import api, { resolveApiUrl } from "@/lib/api";
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
        on ? "bg-sage" : "border-[1.5px] border-line bg-[var(--bg-surface-2)]"
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
  enabled: false,
}));

/** Read the logged-in user's id from the safecircle_user cookie. */
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

/** Build duration options in 5-minute steps within [min, max]. */
function buildDurationOptions(min: number, max: number) {
  const options: { value: string; label: string }[] = [];
  // Common increments: 25, 30, 45, 50, 60, 90 — keep only those within range,
  // plus always include min and max themselves.
  const candidates = [min, 25, 30, 45, 50, 60, 75, 90, max];
  const seen = new Set<number>();
  for (const v of candidates) {
    if (v >= min && v <= max && !seen.has(v)) {
      seen.add(v);
      options.push({ value: String(v), label: `${v} minutes` });
    }
  }
  options.sort((a, b) => Number(a.value) - Number(b.value));
  return options;
}

export default function AvailabilityPage() {
  const dispatch = useAppDispatch();
  const onDemand = useAppSelector((s) => s.coach.onDemand);

  const [slots, setSlots] = useState<SlotEntry[]>(DEFAULT_SLOTS);
  const [duration, setDuration] = useState("50");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Platform-enforced limits (fetched from admin settings)
  const [durationMax, setDurationMax] = useState(90);
  const [durationMin, setDurationMin] = useState(25);

  // Fetch platform limits from the public endpoint (no auth required)
  useEffect(() => {
    const base = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
    fetch(`${base}/api/auth/platform-settings`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { sessionDurationMax?: number; sessionDurationMin?: number }) => {
        if (data.sessionDurationMax) setDurationMax(data.sessionDurationMax);
        if (data.sessionDurationMin) setDurationMin(data.sessionDurationMin);
      })
      .catch(() => {
        // silently fall back to defaults (90 / 25)
      });
  }, []);

  // Load saved availability on mount
  useEffect(() => {
    const coachId = getCoachIdFromCookie();
    if (!coachId) return;

    api
      .get<{ slots: SlotEntry[]; duration: number }>(`/api/sessions/availability/${coachId}`)
      .then(({ data }) => {
        if (data.slots && data.slots.length > 0) {
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
    const numDuration = Number(duration);
    if (numDuration > durationMax) {
      toast.error(`Session duration cannot exceed ${durationMax} minutes (set by admin).`);
      return;
    }
    if (numDuration < durationMin) {
      toast.error(`Session duration must be at least ${durationMin} minutes (set by admin).`);
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/sessions/availability", {
        slots,
        duration: numDuration,
      });
      toast.success("Availability saved");
    } catch {
      toast.error("Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  const durationOptions = buildDurationOptions(durationMin, durationMax);

  // If current selection is out of range, clamp it to the nearest valid option
  const effectiveDuration = (() => {
    const n = Number(duration);
    if (n > durationMax) return String(durationMax);
    if (n < durationMin) return String(durationMin);
    // If exact value isn't in options, pick closest
    const vals = durationOptions.map((o) => Number(o.value));
    if (vals.includes(n)) return duration;
    const closest = vals.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
    return String(closest);
  })();

  return (
    <DashboardLayout title="Availability">
      <div className="max-w-[540px] anim-up space-y-4">
        <Card>
          <h3 className="mb-4 serif text-lg font-semibold text-ink">Weekly Availability</h3>
          {slots.map((slot) => {
            const on = slot.enabled;
            return (
              <div key={slot.day} className="mb-4 flex flex-wrap items-center gap-3">
                <div className="w-24 text-[13px] font-semibold text-ink">{slot.day}</div>
                <input
                  className={cn(
                    "w-[100px] rounded-[9px] border-[1.5px] border-line bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-sage",
                    !on && "opacity-40"
                  )}
                  disabled={!on}
                  value={slot.start}
                  onChange={(e) => updateSlot(slot.day, "start", e.target.value)}
                />
                <span className="text-sm text-dim">to</span>
                <input
                  className={cn(
                    "w-[100px] rounded-[9px] border-[1.5px] border-line bg-card px-3 py-2 text-[13.5px] text-ink outline-none focus:border-sage",
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
              options={durationOptions}
              value={effectiveDuration}
              onChange={setDuration}
            />
            <p className="mt-1 text-xs text-dim">
              Allowed range: {durationMin}–{durationMax} minutes (set by admin)
            </p>
          </div>
          <Button type="button" className="mt-4" onClick={handleSave} disabled={saving || !loaded}>
            {saving ? "Saving…" : "Save Availability"}
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
