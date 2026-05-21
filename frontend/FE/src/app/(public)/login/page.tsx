import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { parseAuthRole } from "@/lib/auth-roles";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to continue your wellness journey.",
};

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialRole = parseAuthRole(params.role ?? null);

  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" aria-hidden />}>
      <LoginScreen initialRole={initialRole} />
    </Suspense>
  );
}
