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
      <div className="animate-fadeIn">
        <div className="mb-6">
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-dim">
            Your Care Team
          </div>
          <p className="text-sm text-mid">Culturally matched coaches available now</p>
        </div>

        {isLoading && (
          <div className="py-10 text-center text-sm text-mid">Loading coaches…</div>
        )}

        {isError && (
          <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {(error as Error)?.message ?? "Failed to load coaches. Please try again."}
          </div>
        )}

        {!isLoading && !isError && coaches?.map((c) => (
          <CoachCard
            key={c.id}
            coach={c}
            onMessage={() => assignAndNavigate(c.id)}
            disabled={isPending && pendingCoachId === c.id}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
