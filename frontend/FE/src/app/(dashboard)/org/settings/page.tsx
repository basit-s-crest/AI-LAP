"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useLogout } from "@/hooks/auth/useLogout";
import { useOrgSettings, useUpdateOrgSettings } from "@/hooks/org/useOrgSettings";

export default function OrgSettingsPage() {
  const logout = useLogout();
  const { data, isPending, isError, error } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();
  const [name, setName] = useState("");
  const [type, setType] = useState("University");

  useEffect(() => {
    if (data) {
      setName(data.name);
      setType(data.type);
    }
  }, [data]);

  const saveDetails = () => {
    updateSettings.mutate(
      { name, type },
      {
        onSuccess: () => toast.success("Organization settings updated"),
        onError: (err) => toast.error(err.message || "Failed to update settings"),
      }
    );
  };

  const toggle = (
    key: "notifyWeeklyReport" | "notifyCrisisAlerts" | "notifyNewMembers",
    value: boolean
  ) => {
    updateSettings.mutate(
      { [key]: value },
      {
        onSuccess: () => {
          toast.success(value ? "Notifications enabled" : "Notifications disabled");
        },
        onError: (err) => toast.error(err.message || "Failed to update notification"),
      }
    );
  };

  const Toggle = ({
    on,
    onClick,
    disabled,
  }: {
    on: boolean;
    onClick: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
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

  return (
    <DashboardLayout title="Settings">
      {isPending ? (
        <div className="h-28 animate-pulse rounded-card border-[1.5px] border-line bg-[var(--bg-surface-2)]" />
      ) : isError ? (
        <Card className="text-sm text-danger">{error.message || "Failed to load settings"}</Card>
      ) : data ? (
        <div className="w-full">
          <div className="grid anim-up grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <Card>
                <h3 className="mb-4 serif text-lg font-semibold text-ink">Organization Details</h3>
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Organization Name</Label>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      options={[
                        { value: "University", label: "University" },
                        { value: "Health Insurer", label: "Health Insurer" },
                        { value: "Non-Profit", label: "Non-Profit" },
                        { value: "Health System", label: "Health System" },
                      ]}
                      value={type}
                      onChange={setType}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <Label>Primary Contact Email</Label>
                  <Input type="email" value={data.primaryContactEmail} disabled className="opacity-60 text-ink" />
                </div>
                <div className="mb-4">
                  <Label>Plan</Label>
                  <Input value={data.plan} disabled className="opacity-60 text-ink" />
                </div>
                <Button type="button" onClick={saveDetails} disabled={updateSettings.isPending}>
                  Save Changes
                </Button>
              </Card>

              <Button type="button" variant="ghost" onClick={logout}>
                Sign Out
              </Button>
            </div>

            <div className="space-y-4">
              <Card>
                <h3 className="mb-3 serif text-lg font-semibold text-ink">Notifications</h3>
                {[
                  {
                    label: "Weekly Outcome Reports",
                    description: "Emailed every Monday",
                    value: data.notifyWeeklyReport,
                    key: "notifyWeeklyReport" as const,
                  },
                  {
                    label: "Crisis Alerts",
                    description: "Immediate notification for flagged members",
                    value: data.notifyCrisisAlerts,
                    key: "notifyCrisisAlerts" as const,
                  },
                  {
                    label: "New Member Joins",
                    description: "Daily digest",
                    value: data.notifyNewMembers,
                    key: "notifyNewMembers" as const,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 border-b border-line py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-ink">{item.label}</div>
                      <div className="mt-0.5 text-xs text-dim">{item.description}</div>
                    </div>
                    <Toggle
                      on={item.value}
                      onClick={() => toggle(item.key, !item.value)}
                      disabled={updateSettings.isPending}
                    />
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
