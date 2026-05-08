"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { ProfileCard } from "@/components/cards/ProfileCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAppSelector, useAppDispatch } from "@/hooks/redux";
import { logout } from "@/store/slices/authSlice";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
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

export default function ProfilePage() {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const name = user?.firstName ?? "Amara";
  const [notifs, setNotifs] = useState([
    { l: "Group Activity", d: "New posts in your groups", on: true },
    { l: "Session Reminders", d: "24h before your session", on: true },
    { l: "Daily Check-in", d: "Morning reminder at 9am", on: false },
    { l: "Weekly Summary", d: "Your weekly wellbeing report", on: true },
  ]);

  return (
    <DashboardLayout title="My Profile">
      <div className="grid animate-fadeIn grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <ProfileCard
            emoji="🌿"
            name={`${name} J.`}
            subtitle="Member since January 2025"
            stats={[
              { value: "6", label: "Day Streak" },
              { value: "22", label: "Check-ins" },
              { value: "2", label: "Groups" },
              { value: "8", label: "Sessions" },
            ]}
            className="mb-4"
          />
          <Card>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              Account Settings
            </div>
            {[
              { e: "👤", bg: "#D4EDD7", l: "Edit Profile" },
              { e: "📋", bg: "#D4E8F5", l: "Retake Assessments" },
              { e: "🔒", bg: "#D4EDD7", l: "Privacy & Data" },
              { e: "❓", bg: "#F5E6C8", l: "Help & Support" },
              { e: "🚪", bg: "#FAE0DC", l: "Sign Out" },
            ].map((it) => (
              <button
                key={it.l}
                type="button"
                className="flex w-full items-center gap-3 border-b border-[rgba(60,50,40,0.08)] py-3 text-left last:border-b-0"
                onClick={() => {
                  if (it.l === "Sign Out") {
                    dispatch(logout());
                    router.push("/");
                  }
                }}
              >
                <div
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] text-base"
                  style={{ background: it.bg }}
                >
                  {it.e}
                </div>
                <span className="flex-1 text-[13px] font-semibold">{it.l}</span>
                <span className="text-dim">›</span>
              </button>
            ))}
          </Card>
        </div>
        <div>
          <Card className="mb-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              Notifications
            </div>
            {notifs.map((n, i) => (
              <div
                key={n.l}
                className="flex items-center gap-3 border-b border-[rgba(60,50,40,0.08)] py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{n.l}</div>
                  <div className="mt-0.5 text-xs text-dim">{n.d}</div>
                </div>
                <Toggle
                  on={n.on}
                  onToggle={() =>
                    setNotifs((xs) => xs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))
                  }
                />
              </div>
            ))}
          </Card>
          <Card className="border-0 bg-sage-soft">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              Assessment Scores
            </div>
            {[
              { l: "PHQ-8 (Depression)", v: "7/24", tag: "Mild", tc: "gold" as const },
              { l: "GAD-7 (Anxiety)", v: "5/21", tag: "Mild", tc: "gold" as const },
            ].map((a) => (
              <div key={a.l} className="mb-3 flex items-center justify-between">
                <div className="text-[13px] font-semibold">{a.l}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-sage">{a.v}</span>
                  <Badge variant={a.tc}>{a.tag}</Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-1">
              Retake assessments →
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
