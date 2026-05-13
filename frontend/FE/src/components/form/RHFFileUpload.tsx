"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Label } from "@/components/ui/Label";
import { cn } from "@/lib/cn";

export function RHFFileUpload({
  name,
  label,
  accept,
  className,
}: {
  name: string;
  label?: string;
  accept?: string;
  className?: string;
}) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value, ...field }, fieldState }) => (
        <div className={cn("w-full", className)}>
          {label ? <Label>{label}</Label> : null}
          <input
            type="file"
            accept={accept}
            className="block w-full text-sm text-mid file:mr-3 file:rounded-lg file:border-0 file:bg-sage-soft file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sage"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
            {...field}
          />
          {value && value instanceof File ? (
            <p className="mt-1 text-xs text-dim">{value.name}</p>
          ) : null}
          {fieldState.error?.message ? (
            <p className="mt-1 text-xs text-danger">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
}
