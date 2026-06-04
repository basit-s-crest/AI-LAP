"use client";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";
  
  return <OnboardingFlow returnTo={returnTo} />;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div>Loading onboarding...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
