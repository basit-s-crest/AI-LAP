import type { Metadata } from "next";
import { VerifyScreen } from "@/components/auth/VerifyScreen";

export const metadata: Metadata = {
  title: "Verify",
  robots: { index: false },
};

export default function VerifyPage() {
  return <VerifyScreen />;
}
