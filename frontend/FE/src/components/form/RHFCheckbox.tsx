"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/Checkbox";

export function RHFCheckbox({ name, label }: { name: string; label?: string }) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Checkbox
          name={field.name}
          checked={!!field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          ref={field.ref}
          label={label}
        />
      )}
    />
  );
}
