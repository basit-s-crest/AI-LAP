"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { verifySchema } from "@/validations/auth.validation";
import { RHFOtpInput } from "@/components/form/RHFOtpInput";
import { Button } from "@/components/ui/Button";
import { authService } from "@/services/auth.service";
import { useAppDispatch } from "@/hooks/redux";
import { setSession } from "@/store/slices/authSlice";

type FormValues = { code: string };

export function VerifyScreen() {
  const search = useSearchParams();
  const dispatch = useAppDispatch();
  const userId = search.get("userId") ?? "";
  const [resendCooldown, setResendCooldown] = useState(false);

  const methods = useForm<FormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  const verifyMutation = useMutation({
    mutationFn: ({ code }: FormValues) => authService.verifyOtp(userId, code),
    onSuccess: (session) => {
      // Set session — writes azadi_token + azadi_role cookies synchronously
      dispatch(setSession(session));
      toast.success("Email verified — welcome!");
      // Full navigation so the browser sends the new cookies to the middleware
      window.location.href = "/onboarding";
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Invalid or expired code");
      methods.setValue("code", "");
    },
  });

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const resendMutation = useMutation({
    mutationFn: () => authService.resendOtp(userId),
    onSuccess: () => {
      toast.success("New code sent — check your inbox");
      // 60-second cooldown to prevent spam
      setResendCooldown(true);
      setTimeout(() => setResendCooldown(false), 60_000);
    },
    onError: (e: Error) => {
      toast.error(e.message ?? "Could not resend code");
    },
  });

  const onSubmit = methods.handleSubmit((data) => verifyMutation.mutate(data));

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <p className="text-mid">Invalid verification link. Please register again.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <FormProvider {...methods}>
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md animate-fadeIn rounded-card border border-line bg-card p-8"
        >
          <div className="mb-4 text-center text-[42px]">📬</div>
          <h3 className="text-center font-serif text-[28px] font-semibold text-ink">
            Check your email
          </h3>
          <p className="mb-6 text-center text-[13.5px] text-mid">
            We sent a 6-digit code to your email. It expires in 15 minutes.
          </p>

          <RHFOtpInput name="code" />

          <Button
            type="submit"
            fullWidth
            className="mt-4"
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending ? "Verifying…" : "Verify Code"}
          </Button>

          <p className="mt-4 text-center text-sm text-mid">
            Didn&apos;t receive it?{" "}
            <button
              type="button"
              onClick={() => resendMutation.mutate()}
              disabled={resendCooldown || resendMutation.isPending}
              className="font-semibold text-sage disabled:opacity-40 hover:underline"
            >
              {resendCooldown ? "Resend in 60s" : "Resend code"}
            </button>
          </p>
        </form>
      </FormProvider>
    </div>
  );
}
