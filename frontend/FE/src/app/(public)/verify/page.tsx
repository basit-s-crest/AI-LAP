import type { Metadata } from "next";
import { VerifyScreen } from "@/components/auth/VerifyScreen";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Verify",
  robots: { index: false },
};

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading verification...</div>}>
      <VerifyScreen />
    </Suspense>
  );
}
