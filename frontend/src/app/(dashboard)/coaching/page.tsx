"use client";

import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CoachCard } from "@/components/cards/CoachCard";
import { useCoachesQuery } from "@/hooks/api/use-coaches";

export default function CoachingPage() {
  const router = useRouter();
  const { data: coaches = [] } = useCoachesQuery();

  return (
    <DashboardLayout title="Coaching">
      <div className="animate-fadeIn">
        <div className="mb-6">
          <div className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-dim">
            Your Care Team
          </div>
          <p className="text-sm text-mid">Culturally matched coaches available now</p>
        </div>
        {coaches.map((c) => (
          <CoachCard
            key={c.id}
            coach={c}
            onMessage={() => router.push(`/coaching/${c.id}`)}
            onBook={() => router.push(`/coaching/${c.id}?book=1`)}
          />
        ))}
      </div>
    </DashboardLayout>
  );
}
