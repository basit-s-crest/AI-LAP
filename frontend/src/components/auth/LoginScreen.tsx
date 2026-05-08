"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "@/validations/auth.validation";
import { RHFInput } from "@/components/form/RHFInput";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
//import { useLoginMutation } from "@/hooks/api/use-auth-mutations";
import { useLogin } from "@/hooks/auth/useLogin"
import { toast } from "sonner";
import { Controller } from "react-hook-form";
import { DEFAULT_LOGIN_REDIRECT } from "@/constants/routes";
import { getAuthRoleOption, parseAuthRole } from "@/lib/auth-roles";

type FormValues = { email: string; password: string };

export function LoginScreen() {
 // const login = useLoginMutation();
  const login = useLogin();
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || DEFAULT_LOGIN_REDIRECT;
  const role = parseAuthRole(search.get("role"));
  const roleOption = getAuthRoleOption(role);

  const methods = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: roleOption.loginEmail, password: "demo1234" },
  });

  const onSubmit = methods.handleSubmit(async (data) => {
    try {
      await login.mutateAsync(data);
      toast.success("Welcome back");
      router.push(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    }
  });

  return (
    <div className="flex min-h-screen bg-canvas">
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
              <span className="text-sage-light">OK</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex w-full max-w-[600px] items-center justify-center bg-card px-10 py-14 lg:w-[600px]">
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="w-full animate-fadeIn">
            <h3 className="mb-1 font-serif text-[28px] font-semibold text-ink">Welcome Back</h3>
            <p className="mb-7 text-[13.5px] text-mid">
              Sign in to continue as {roleOption.label}
            </p>
            <div className="mb-4">
              <Label htmlFor="email">Email</Label>
              <RHFInput name="email" placeholder="you@example.com" />
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
              Sign In -&gt;
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
