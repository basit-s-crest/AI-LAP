import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Azadi Health to continue your wellness journey.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" aria-hidden />}>
      <LoginScreen />
    </Suspense>
  );
}
