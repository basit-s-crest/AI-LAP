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
    <div className="flex min-h-screen items-center justify-center px-6">
      <FormProvider {...methods}>
        <form
          onSubmit={onSubmit}
          className="card w-full max-w-md anim-scale"
        >
          <h3 className="auth-form-title text-center mb-1">Reset password</h3>
          <p className="auth-form-sub text-center mb-6">We&apos;ll email you a reset link.</p>
          <div className="form-group">
            <Label className="form-label">Email</Label>
            <RHFInput name="email" type="email" className="input" placeholder="you@example.com" />
          </div>
          <Button type="submit" className="btn btn-primary w-full mt-2">
            Send Link
          </Button>
          <Link href="/login" className="mt-4 block text-center text-sm text-sage hover:underline font-semibold">
            Back to sign in
          </Link>
        </form>
      </FormProvider>
    </div>
  );
}
