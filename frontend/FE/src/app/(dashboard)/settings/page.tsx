"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useAppSelector, useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { useLogout } from "@/hooks/auth/useLogout";
import {
  useCoachProfile,
  useUpdateCoachProfile,
  useUpdateCoachNotifications,
} from "@/hooks/settings/useCoachSettings";
import type { CoachProfileResponse } from "@/services/settings.service";

const AVATAR_EMOJIS = ["🌿", "😊", "🌸", "💚", "🦋", "☀️", "🌊", "⭐", "🌙", "🍀"];

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

function CoachSettings() {
  const dispatch = useAppDispatch();
  const logout = useLogout();
  const token = useAppSelector((s) => s.auth.token);
  const { data, isPending, isError, error } = useCoachProfile();
  const updateProfile = useUpdateCoachProfile();
  const updateNotifications = useUpdateCoachNotifications();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [avatar, setAvatar] = useState("🌿");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (data) {
      setName(data.coach.name);
      setBio(data.coach.bio ?? "");
      setSpeciality(data.coach.speciality ?? "");
      setAvatar(data.coach.avatar ?? "🌿");
    }
  }, [data]);

  const saveProfile = () => {
    updateProfile.mutate(
      {
        name,
        bio,
        speciality,
        avatar,
        ...(newPassword ? { newPassword, confirmPassword } : {}),
      },
      {
        onSuccess: (res) => {
          toast.success("Profile updated");
          setNewPassword("");
          setConfirmPassword("");
          const c = res.coach;
          if (token && c) {
            const parts = c.name.trim().split(/\s+/);
            dispatch(
              setSession({
                token,
                user: {
                  id: c.id,
                  email: c.email,
                  firstName: parts[0] ?? "",
                  lastName: parts.slice(1).join(" "),
                  role: "coach",
                  avatarEmoji: c.avatar ?? "🌿",
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
    key: keyof CoachProfileResponse["notifications"],
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
    return <div className="h-40 animate-pulse rounded-card border border-line bg-[var(--bg-surface-2)]" />;
  }
  if (isError || !data) {
    return <Card className="text-sm text-danger">{error?.message ?? "Failed to load settings"}</Card>;
  }

  const notifRows = [
    { key: "notifySessionReminders" as const, l: "Session Reminders", d: "24h before sessions" },
    { key: "notifyNewClientAssigned" as const, l: "New Client Assigned", d: "When a member is assigned to you" },
    { key: "notifyMessageAlerts" as const, l: "Message Alerts", d: "New messages from clients" },
  ];

  return (
    <div className="w-full">
      <div className="grid anim-up grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <Card className="border-line bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-teal text-3xl">
                {avatar}
              </div>
              <div>
                <div className="serif text-xl font-semibold text-ink">{name}</div>
                {speciality && <div className="mt-1 text-sm text-dim">{speciality}</div>}
                {bio && <p className="mt-2 text-xs leading-relaxed text-mid">{bio}</p>}
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 serif text-lg font-semibold">Profile</h3>
            <div className="mb-4">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="mb-4">
              <Label>Organization / Bio</Label>
              <Input value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
            <div className="mb-4">
              <Label>Speciality</Label>
              <Input value={speciality} onChange={(e) => setSpeciality(e.target.value)} />
            </div>
            <div className="mb-4">
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
            <div className="mb-4">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="mb-4">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="button" onClick={saveProfile} disabled={updateProfile.isPending}>
              Save Profile
            </Button>
          </Card>

          <Button type="button" variant="ghost" onClick={logout}>
            Sign Out
          </Button>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 serif text-lg font-semibold">Notifications</h3>
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
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const role = useAppSelector((s) => s.auth.user?.role);

  useEffect(() => {
    if (role === "organization") {
      router.replace("/org/settings");
    } else if (role === "user") {
      router.replace("/profile");
    }
  }, [role, router]);

  if (role === "organization") {
    return (
      <DashboardLayout title="Settings">
        <div className="text-sm text-dim">Redirecting to organization settings…</div>
      </DashboardLayout>
    );
  }

  if (role === "user") {
    return (
      <DashboardLayout title="Settings">
        <div className="text-sm text-dim">Redirecting to your profile…</div>
      </DashboardLayout>
    );
  }

  if (role !== "coach") {
    return (
      <DashboardLayout title="Settings">
        <Card className="text-sm text-dim">Settings are not available for this account.</Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings">
      <CoachSettings />
    </DashboardLayout>
  );
}
