"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema } from "@/validations/auth.validation";
import { RHFInput } from "@/components/form/RHFInput";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useLogin } from "@/hooks/auth/useLogin";
import { useEffect } from "react";
import { useAuthRoleParam } from "@/hooks/useAuthRoleParam";
import { useHydratedPlatformBranding } from "@/hooks/useHydratedPlatformBranding";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";
import { useMaintenanceRedirect } from "@/hooks/useMaintenanceRedirect";
import type { Role } from "@/types/role";

type FormValues = { email: string; password: string };

type LoginScreenProps = {
  initialRole?: Role;
};

export function LoginScreen({ initialRole }: LoginScreenProps) {
  const search = useSearchParams();
  const router = useRouter();
  const { role, roleOption } = useAuthRoleParam(initialRole);
  const justRegistered = search.get("registered") === "1";
  const { data: platformSettings } = usePublicPlatformSettings();
  const { brandTitle, brandTagline } = useHydratedPlatformBranding();
  useMaintenanceRedirect();

  // Pass role so the hook hits the right backend endpoint (coach vs member)
  const login = useLogin(role);

  // Show success message when arriving from coach registration
  useEffect(() => {
    if (justRegistered) {
      toast.success("Coach account created — sign in to continue");
    }
  }, [justRegistered]);

  const methods = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = methods.handleSubmit(async (data) => {
    try {
      await login.mutateAsync(data);
      toast.success("Welcome back");
      // router.replace is called inside useLogin.onSuccess — no need here
    } catch (e: unknown) {
      // The api interceptor converts axios errors to plain Error objects,
      // but for the 403 "not verified" case it re-throws the raw axios error
      // so we can extract userId from the response body.
      const axiosData = (e as any)?.response?.data;
      if (axiosData?.userId) {
        toast.error("Please verify your email first");
        router.push(`/verify?userId=${axiosData.userId}`);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  });

  return (
    <div className="auth-screen">
      {/* ── Left panel ── */}
      <div className="auth-panel">
        <div className="auth-panel-bg" />
        <div className="auth-logo">{brandTitle}</div>
        <div className="auth-logo-sub">{brandTagline}</div>
        <div className="auth-quote">
          &quot;Healing is not linear, but you don&apos;t have to walk the path alone.&quot;
          <cite>— SafeCircle Mission</cite>
        </div>
        <div className="auth-checks">
          {[
            "Culturally responsive care",
            "Private & HIPAA-compliant",
            "Community-centered healing",
            "Available 7 days a week",
          ].map((f) => (
            <div key={f} className="auth-check">
              <span className="auth-check-icon">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner anim-scale">
          <FormProvider {...methods}>
            <form onSubmit={onSubmit} className="w-full">
              <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sage">
                {roleOption.label}
              </p>
              <h3 className="auth-form-title">
                Welcome Back
              </h3>
              <p className="auth-form-sub">
                Sign in to your {roleOption.label.toLowerCase()} account
              </p>

              <div className="form-group">
                <Label className="form-label" htmlFor="email">Email</Label>
                <RHFInput name="email" type="email" placeholder="you@example.com" className="input" />
              </div>

              <div className="form-group">
                <Label className="form-label" htmlFor="password">Password</Label>
                <Controller
                  name="password"
                  control={methods.control}
                  render={({ field, fieldState }) => (
                    <PasswordInput
                      {...field}
                      placeholder="Your password"
                      error={fieldState.error?.message}
                      className="input"
                    />
                  )}
                />
              </div>

              <Link
                href="/forgot-password"
                className="mb-4 block text-right text-xs text-sage hover:underline"
              >
                Forgot password?
              </Link>

              <Button type="submit" className="btn btn-primary w-full" disabled={login.isPending}>
                {login.isPending ? "Signing in…" : "Sign In →"}
              </Button>

              <div className="my-4 flex items-center gap-3 text-xs text-dim">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>

              {role !== "user" || platformSettings?.allowSelfRegistration !== false ? (
                role !== "superadmin" && (
                  <p className="text-center text-sm text-mid">
                    New to {brandTitle}?{" "}
                    <Link
                      href={`/register?role=${role}`}
                      className="font-bold text-sage hover:underline"
                    >
                      Create account
                    </Link>
                  </p>
                )
              ) : null}
              <p className="mt-3 text-center text-xs text-dim">
                Organization admin?{" "}
                <Link href="/org-login" className="font-semibold text-sage hover:underline">
                  Sign in here
                </Link>
              </p>
            </form>
          </FormProvider>
        </div>
      </div>
    </div>
  );
}
