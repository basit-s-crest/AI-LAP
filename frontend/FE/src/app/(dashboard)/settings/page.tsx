"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default function OrgSettingsPage() {
  const [notifs, setNotifs] = useState([
    { l: "Weekly Outcome Reports", d: "Emailed every Monday", on: true },
    { l: "Crisis Alerts", d: "Immediate notification for flagged members", on: true },
    { l: "New Member Joins", d: "Daily digest", on: false },
  ]);

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
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

  return (
    <DashboardLayout title="Settings">
      <div className="max-w-[640px] animate-fadeIn space-y-4">
        <Card>
          <h3 className="mb-4 font-serif text-lg font-semibold">Organization Details</h3>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Organization Name</Label>
              <Input defaultValue="State University System" />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                options={[
                  { value: "uni", label: "University" },
                  { value: "ins", label: "Health Insurer" },
                  { value: "ngo", label: "Non-Profit" },
                  { value: "sys", label: "Health System" },
                ]}
                value="uni"
                onChange={() => {}}
              />
            </div>
          </div>
          <div className="mb-4">
            <Label>Primary Contact Email</Label>
            <Input type="email" defaultValue="dr.chen@stateU.edu" />
          </div>
          <div className="mb-4">
            <Label>Plan</Label>
            <Input defaultValue="Enterprise" disabled className="opacity-60" />
          </div>
          <Button type="button">Save Changes</Button>
        </Card>
        <Card>
          <h3 className="mb-3 font-serif text-lg font-semibold">Notifications</h3>
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
                onClick={() =>
                  setNotifs((xs) => xs.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))
                }
              />
            </div>
          ))}
        </Card>
      </div>
    </DashboardLayout>
  );
}
