"use client";

import Link from "next/link";
import { useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RHFInput } from "@/components/form/RHFInput";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { authService } from "@/services/auth.service";
import { useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";
import { loginSchema } from "@/validations/auth.validation";
import { useMaintenanceRedirect } from "@/hooks/useMaintenanceRedirect";

type FormValues = { email: string; password: string };

export default function OrgLoginPage() {
  const dispatch = useAppDispatch();
  useMaintenanceRedirect();
  const [error, setError] = useState("");
  const methods = useForm<FormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = methods.handleSubmit(async (data) => {
    setError("");
    try {
      const session = await authService.orgLogin(data);
      dispatch(setSession(session));
      window.location.href = "/org/dashboard";
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Login failed");
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
            Organization Portal
          </p>
        </div>
      </div>

      <div className="flex w-full max-w-[600px] items-center justify-center bg-card px-10 py-14 lg:w-[600px]">
        <FormProvider {...methods}>
          <form onSubmit={onSubmit} className="w-full animate-fadeIn">
            <p className="mb-2 text-xs font-bold uppercase tracking-[2px] text-sage">
              Organization Portal
            </p>
            <h3 className="mb-1 font-serif text-[28px] font-semibold text-ink">Organization Portal</h3>
            <p className="mb-7 text-[13.5px] text-mid">
              Sign in to manage your organization
            </p>

            <div className="mb-4">
              <Label htmlFor="email">Email</Label>
              <RHFInput name="email" type="email" placeholder="org@stateuniversity.com" />
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

            <Button type="submit" size="lg" fullWidth>
              Sign In →
            </Button>
            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

            <p className="mt-6 text-center text-sm text-mid">
              Super admin?{" "}
              <Link href="/login" className="font-bold text-sage hover:underline">
                Sign in here
              </Link>
            </p>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
