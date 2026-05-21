import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterScreen } from "@/components/auth/RegisterScreen";
import { parseAuthRole } from "@/lib/auth-roles";

export const metadata: Metadata = {
  title: "Create account",
};

type PageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function RegisterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialRole = parseAuthRole(params.role ?? null);

  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" aria-hidden />}>
      <RegisterScreen initialRole={initialRole} />
    </Suspense>
  );
}
