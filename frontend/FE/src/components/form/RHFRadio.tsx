"use client";

import { Controller, useFormContext } from "react-hook-form";
import { RadioGroupField, type RadioOption } from "@/components/ui/Radio";
import { Label } from "@/components/ui/Label";

export function RHFRadio({
  name,
  label,
  options,
}: {
  name: string;
  label?: string;
  options: RadioOption[];
}) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          {label ? <Label>{label}</Label> : null}
          <RadioGroupField name={name} value={field.value} onChange={field.onChange} options={options} />
          {fieldState.error?.message ? (
            <p className="mt-1 text-xs text-danger">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
}
