import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterScreen } from "@/components/auth/RegisterScreen";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" aria-hidden />}>
      <RegisterScreen />
    </Suspense>
  );
}
