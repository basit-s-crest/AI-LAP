"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";

export function RHFSelect({
  name,
  label,
  options,
  placeholder,
}: {
  name: string;
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          {label ? <Label>{label}</Label> : null}
          <Select
            options={options}
            value={field.value ?? ""}
            onChange={field.onChange}
            placeholder={placeholder}
          />
          {fieldState.error?.message ? (
            <p className="mt-1 text-xs text-danger">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
}
