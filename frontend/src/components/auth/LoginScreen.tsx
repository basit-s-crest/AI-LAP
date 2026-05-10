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
import { getAuthRoleOption, parseAuthRole } from "@/lib/auth-roles";
import { useEffect } from "react";

type FormValues = { email: string; password: string };

export function LoginScreen() {
  const search = useSearchParams();
  const router = useRouter();
  const role = parseAuthRole(search.get("role"));
  const roleOption = getAuthRoleOption(role);
  const justRegistered = search.get("registered") === "1";

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
    <div className="flex min-h-screen bg-canvas">
      {/* ── Left panel ── */}
      <div className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-sidebar p-[60px] lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 50%, rgba(78,140,88,.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(179,90,56,.12) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-[1]">
          <h1 className="font-serif text-[60px] font-bold leading-none tracking-wide text-[#FDFAF5]">
            Azadi
            <br />
            Health
          </h1>
          <p className="mt-2.5 text-xs uppercase tracking-[3px] text-[#FDFAF5]/40">
            Mental Wellness Platform
          </p>
        </div>
        <div className="relative z-[1] mt-[52px]">
          <h2 className="max-w-lg font-serif text-[28px] font-normal italic leading-snug text-[#FDFAF5]/80">
            &quot;Healing is not linear, but you don&apos;t have to walk the path alone.&quot;
          </h2>
        </div>
        <ul className="relative z-[1] mt-11 space-y-3 text-[13.5px] text-[#FDFAF5]/60">
          {[
            "Culturally responsive care",
            "Private & HIPAA-compliant",
            "Community-centered healing",
            "Available 7 days a week",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="text-sage-light">✓</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Right panel ── */}
      <div className="flex w-full max-w-[600px] items-center justify-center bg-card px-10 py-14 lg:w-[600px]">
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="w-full animate-fadeIn">
            <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sage">
              {roleOption.label}
            </p>
            <h3 className="mb-1 font-serif text-[28px] font-semibold text-ink">
              Welcome Back
            </h3>
            <p className="mb-7 text-[13.5px] text-mid">
              Sign in to your {roleOption.label.toLowerCase()} account
            </p>

            <div className="mb-4">
              <Label htmlFor="email">Email</Label>
              <RHFInput name="email" type="email" placeholder="you@example.com" />
            </div>

            <div className="mb-4">
              <Label htmlFor="password">Password</Label>
              <Controller
                name="password"
                control={methods.control}
                render={({ field, fieldState }) => (
                  <PasswordInput
                    {...field}
                    placeholder="Your password"
                    error={fieldState.error?.message}
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

            <Button type="submit" size="lg" fullWidth disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign In →"}
            </Button>

            <div className="my-4 flex items-center gap-3 text-xs text-dim">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <p className="text-center text-sm text-mid">
              New to Azadi?{" "}
              <Link
                href={`/register?role=${role}`}
                className="font-bold text-sage hover:underline"
              >
                Create account
              </Link>
            </p>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
