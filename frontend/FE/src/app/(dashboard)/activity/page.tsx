"use client";

import { useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { ActivityCardRow } from "@/components/cards/ActivityCard";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useActivityQuery } from "@/hooks/api/use-admin";

export default function ActivityPage() {
  const { data: activity = [], isPending } = useActivityQuery();
  const items = useMemo(() => [...activity, ...activity], [activity]);

  return (
    <DashboardLayout title="Activity Log">
      <Card className="animate-fadeIn">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold">System Activity Log</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[140px]">
              <Select
                options={[
                  { value: "all", label: "All Types" },
                  { value: "alert", label: "Alerts" },
                  { value: "session", label: "Sessions" },
                  { value: "moderation", label: "Moderation" },
                ]}
                value="all"
                onChange={() => {}}
              />
            </div>
            <Button variant="ghost" size="sm" type="button">
              Export CSV
            </Button>
          </div>
        </div>
        {isPending ? (
          <p className="text-sm text-mid">Loading activity…</p>
        ) : (
          items.map((a, i) => <ActivityCardRow key={i} {...a} />)
        )}
      </Card>
    </DashboardLayout>
  );
}
