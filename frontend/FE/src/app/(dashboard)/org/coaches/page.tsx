"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useOrgCoaches } from "@/hooks/org/useOrgCoaches";

export default function OrgCoachesPage() {
  const { data: coaches = [], isPending, isError, error } = useOrgCoaches();

  return (
    <DashboardLayout title="Our Coaches">
      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-card border-[1.5px] border-line bg-[#F0EBE1]" />
          ))}
        </div>
      ) : isError ? (
        <Card className="text-sm text-danger">{error.message || "Failed to load coaches"}</Card>
      ) : coaches.length === 0 ? (
        <Card className="border-0 bg-sage-soft">
          <div className="mb-2 font-semibold">No coaches assigned yet.</div>
          <p className="text-sm text-mid">
            Contact your account manager to assign coaches to your organization.
          </p>
          <button
            type="button"
            className="mt-3 rounded-md border border-[rgba(60,50,40,0.15)] px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#EFE8DB]"
          >
            Contact Account Manager
          </button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coaches.map((coach) => (
            <Card key={coach.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{coach.name}</h3>
                  <p className="text-xs text-mid">{coach.email}</p>
                </div>
                <Badge variant={coach.isActive ? "sage" : "dim"}>
                  {coach.isActive ? "active" : "inactive"}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-mid">{coach.speciality || "Speciality not set"}</p>
              <p className="mt-2 text-sm text-mid">{coach.bio || "Bio not available"}</p>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
