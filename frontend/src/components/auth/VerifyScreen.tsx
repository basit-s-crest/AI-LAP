"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { verifySchema } from "@/validations/auth.validation";
import { RHFOtpInput } from "@/components/form/RHFOtpInput";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";

type FormValues = { code: string };

export function VerifyScreen() {
  const router = useRouter();
  const methods = useForm<FormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });

  const onSubmit = methods.handleSubmit(async () => {
    toast.success("Verified");
    router.push("/onboarding");
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <FormProvider {...methods}>
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md animate-fadeIn rounded-card border border-line bg-card p-8"
        >
          <div className="mb-4 text-center text-[42px]">🔐</div>
          <h3 className="text-center font-serif text-[28px] font-semibold text-ink">
            Two-Factor Auth
          </h3>
          <p className="mb-6 text-center text-[13.5px] text-mid">6-digit code sent to your email</p>
          <RHFOtpInput name="code" />
          <Button type="submit" fullWidth className="mt-4">
            Verify Code
          </Button>
          <p className="mt-4 text-center text-sm text-mid">
            Didn&apos;t receive it?{" "}
            <span className="cursor-pointer font-semibold text-sage">Resend</span>
          </p>
        </form>
      </FormProvider>
    </div>
  );
}
