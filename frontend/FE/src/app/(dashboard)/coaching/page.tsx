"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CoachCard } from "@/components/cards/CoachCard";
import { useCoachesQuery } from "@/hooks/api/use-coaches";
import { useAssignCoach } from "@/hooks/useAssignCoach";

export default function CoachingPage() {
  const { data: coaches, isLoading, isError, error } = useCoachesQuery();
  const { assignAndNavigate, isPending, pendingCoachId } = useAssignCoach();

  return (
    <DashboardLayout title="Coaching">
      <div className="anim-up">
        <div className="mb-6">
          <div className="section-label mb-1">
            Find Your Coach
          </div>
          <p className="text-sm text-soft">Browse and message our culturally matched care specialists.</p>
        </div>

        {isLoading && (
          <div className="py-10 text-center text-sm text-mid">Loading coaches…</div>
        )}

        {isError && (
          <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {(error as Error)?.message ?? "Failed to load coaches. Please try again."}
          </div>
        )}

        {!isLoading && !isError && coaches?.length === 0 && (
          <div className="rounded-card border border-line bg-card/60 p-6 text-center text-sm text-mid">
            No coaches available for your organization
          </div>
        )}

        {!isLoading && !isError && coaches && coaches.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {coaches.map((c) => (
              <CoachCard
                key={c.id}
                coach={c}
                onMessage={() => assignAndNavigate(c.id)}
                disabled={isPending && pendingCoachId === c.id}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
