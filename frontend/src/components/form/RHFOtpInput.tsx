"use client";

import { Controller, useFormContext } from "react-hook-form";
import { OtpInput } from "@/components/ui/OtpInput";
import { Label } from "@/components/ui/Label";

export function RHFOtpInput({ name, label }: { name: string; label?: string }) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          {label ? <Label>{label}</Label> : null}
          <OtpInput value={field.value ?? ""} onChange={field.onChange} />
          {fieldState.error?.message ? (
            <p className="mt-1 text-center text-xs text-danger">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
}
