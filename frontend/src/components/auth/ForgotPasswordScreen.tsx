"use client";

import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema } from "@/validations/auth.validation";
import { RHFInput } from "@/components/form/RHFInput";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { toast } from "sonner";

type FormValues = { email: string };

export function ForgotPasswordScreen() {
  const methods = useForm<FormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = methods.handleSubmit(async () => {
    toast.success("If an account exists, you will receive an email.");
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <FormProvider {...methods}>
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md animate-fadeIn rounded-card border border-line bg-card p-8"
        >
          <h3 className="mb-1 font-serif text-[28px] font-semibold text-ink">Reset password</h3>
          <p className="mb-6 text-sm text-mid">We&apos;ll email you a reset link.</p>
          <div className="mb-4">
            <Label>Email</Label>
            <RHFInput name="email" type="email" />
          </div>
          <Button type="submit" fullWidth>
            Send link
          </Button>
          <Link href="/login" className="mt-4 block text-center text-sm text-sage hover:underline">
            Back to sign in
          </Link>
        </form>
      </FormProvider>
    </div>
  );
}
