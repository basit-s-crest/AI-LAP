"use client";

import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { useSearchParams } from "next/navigation";

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";
  
  return <OnboardingFlow returnTo={returnTo} />;
}
