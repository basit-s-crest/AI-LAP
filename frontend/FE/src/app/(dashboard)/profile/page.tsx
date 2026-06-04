"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { ProfileCard } from "@/components/cards/ProfileCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { useAppSelector, useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { useLogout } from "@/hooks/auth/useLogout";
import {
  useMemberProfile,
  useUpdateMemberProfile,
  useUpdateMemberNotifications,
} from "@/hooks/settings/useMemberSettings";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";

const AVATAR_EMOJIS = ["🌿", "😊", "🌸", "💚", "🦋", "☀️", "🌊", "⭐", "🌙", "🍀"];
import { useQuery } from "@tanstack/react-query";
import { onboardingService } from "@/services/onboarding.service";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
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

function assessmentBadgeVariant(label: string): "gold" | "sage" | "terra" | "blue" {
  if (label === "Severe" || label === "Moderate") return "terra";
  if (label === "Mild") return "gold";
  return "sage";
}

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const logout = useLogout();
  const token = useAppSelector((s) => s.auth.token);
  const { data, isPending, isError, error } = useMemberProfile();
  const updateProfile = useUpdateMemberProfile();
  const updateNotifications = useUpdateMemberNotifications();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatar, setAvatar] = useState("🌿");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();

  const { data: assessment, isLoading } = useQuery({
    queryKey: ["onboarding-assessment"],
    queryFn: () => onboardingService.getMyAssessment(),
  });

  useEffect(() => {
    if (data) {
      setFirstName(data.firstName);
      setLastName(data.lastName);
      setAvatar(data.avatar ?? "🌿");
    }
  }, [data]);

  const saveProfile = () => {
    updateProfile.mutate(
      {
        firstName,
        lastName,
        avatar,
        ...(newPassword ? { newPassword, confirmPassword } : {}),
      },
      {
        onSuccess: (res) => {
          toast.success("Profile updated");
          setEditing(false);
          setNewPassword("");
          setConfirmPassword("");
          if (token) {
            dispatch(
              setSession({
                token,
                user: {
                  id: res.id,
                  email: res.email,
                  firstName: res.firstName,
                  lastName: res.lastName,
                  role: "user",
                  avatarEmoji: res.avatar ?? "🌿",
                },
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              })
            );
          }
        },
        onError: (err) => toast.error(err.message || "Failed to update profile"),
      }
    );
  };

  const toggleNotif = (
    key: keyof NonNullable<typeof data>["notifications"],
    value: boolean
  ) => {
    if (!data) return;
    updateNotifications.mutate(
      { [key]: value },
      {
        onSuccess: () => toast.success("Notification updated"),
        onError: (err) => toast.error(err.message || "Failed to update"),
      }
    );
  };

  if (isPending) {
    return (
      <DashboardLayout title="My Profile">
        <div className="h-48 animate-pulse rounded-card border border-line bg-[var(--bg-surface-2)]" />
      </DashboardLayout>
    );
  }

  if (isError || !data) {
    return (
      <DashboardLayout title="My Profile">
        <Card className="text-sm text-danger">{error?.message ?? "Failed to load profile"}</Card>
      </DashboardLayout>
    );
  }

  const notifRows = [
    { key: "notifyGroupActivity" as const, l: "Group Activity", d: "New posts in your groups" },
    { key: "notifySessionReminders" as const, l: "Session Reminders", d: "24h before your session" },
    { key: "notifyDailyCheckin" as const, l: "Daily Check-in", d: "Morning reminder at 9am" },
  ];

  const getPhqLabel = (score: number, taken: boolean) => {
    if (!taken) return { label: "Not taken", variant: "dim" as const };
    if (score <= 4) return { label: "Minimal", variant: "sage" as const };
    if (score <= 9) return { label: "Mild", variant: "gold" as const };
    if (score <= 14) return { label: "Moderate", variant: "terra" as const };
    if (score <= 19) return { label: "Mod. Severe", variant: "red" as const };
    return { label: "Severe", variant: "red" as const };
  };

  const getGadLabel = (score: number, taken: boolean) => {
    if (!taken) return { label: "Not taken", variant: "dim" as const };
    if (score <= 4) return { label: "Minimal", variant: "sage" as const };
    if (score <= 9) return { label: "Mild", variant: "gold" as const };
    if (score <= 14) return { label: "Moderate", variant: "terra" as const };
    return { label: "Severe", variant: "red" as const };
  };

  const hasPhq = !!(assessment && assessment.phqAnswers && assessment.phqAnswers.length > 0);
  const hasGad = !!(assessment && assessment.gadAnswers && assessment.gadAnswers.length > 0);

  const phqInfo = getPhqLabel(assessment?.phqScore ?? 0, hasPhq);
  const gadInfo = getGadLabel(assessment?.gadScore ?? 0, hasGad);

  return (
    <DashboardLayout title="My Profile">
      <div className="grid anim-up grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <ProfileCard
            emoji={data.avatar ?? "🌿"}
            name={`${data.firstName} ${data.lastName}`.trim()}
            subtitle={`Member since ${data.memberSince}`}
            stats={[
              { value: String(data.stats.dayStreak), label: "Day Streak" },
              { value: String(data.stats.checkIns), label: "Check-ins" },
              { value: String(data.stats.groups), label: "Groups" },
              { value: String(data.stats.sessions), label: "Sessions" },
            ]}
            className="mb-4"
          />
          <Card className="mb-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              Account Settings
            </div>
            {!editing ? (
              <>
                {[
                  { e: "👤", bg: "#D4EDD7", l: "Edit Profile", action: () => setEditing(true) },
                  { e: "🔒", bg: "#D4EDD7", l: "Privacy & Data", action: () => { } },
                  { e: "❓", bg: "#F5E6C8", l: "Help & Support", action: () => { } },
                  { e: "🚪", bg: "#FAE0DC", l: "Sign Out", action: logout },
                ].map((it) => (
                  <button
                    key={it.l}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-b-0"
                    onClick={it.action}
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
              </>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>First Name</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Avatar</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {AVATAR_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setAvatar(em)}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg text-xl",
                          avatar === em ? "bg-sage-soft ring-2 ring-sage" : "bg-canvas"
                        )}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div>
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveProfile} disabled={updateProfile.isPending}>
                    Save Profile
                  </Button>
                </div>
              </div>
            )}
          </Card>

        </div>

        <div>
          <Card className="mb-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              Notifications
            </div>
            {notifRows.map((n) => (
              <div
                key={n.key}
                className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{n.l}</div>
                  <div className="mt-0.5 text-xs text-dim">{n.d}</div>
                </div>
                <Toggle
                  on={data.notifications[n.key]}
                  onToggle={() => toggleNotif(n.key, !data.notifications[n.key])}
                />
              </div>
            ))}
          </Card>
          <Card className="border-0 bg-sage-soft">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-dim">
              Assessment Scores
            </div>
            {isLoading ? (
              <div className="py-4 text-center text-xs text-mid">Loading assessment scores...</div>
            ) : (
              <>
                {[
                  {
                    key: "phq8" as const,
                    l: "PHQ-8 (Depression)",
                    v: hasPhq ? `${assessment?.phqScore}/24` : "—",
                    tag: phqInfo.label,
                    tc: phqInfo.variant,
                    avg: data.assessments?.phq8,
                  },
                  {
                    key: "gad7" as const,
                    l: "GAD-7 (Anxiety)",
                    v: hasGad ? `${assessment?.gadScore}/21` : "—",
                    tag: gadInfo.label,
                    tc: gadInfo.variant,
                    avg: data.assessments?.gad7,
                  },
                ].map((a) => {
                  const showAvg = a.avg && (a.key === "phq8" ? hasPhq : hasGad);
                  return (
                    <div key={a.l} className="mb-3 flex items-center justify-between border-b border-line pb-3 last:border-b-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold">{a.l}</div>
                        {showAvg && a.avg && (
                          <div className="mt-0.5 text-xs text-dim">
                            Average: <span className="font-semibold text-sage">{a.avg.score}/{a.avg.max}</span> ({a.avg.label})
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-sage">{a.v}</span>
                        <Badge variant={a.tc}>{a.tag}</Badge>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={() => router.push("/onboarding?returnTo=/profile")}
            >
              Retake assessments →
            </Button>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
