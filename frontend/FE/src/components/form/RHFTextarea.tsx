"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Textarea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";

export function RHFTextarea({
  name,
  label,
  ...props
}: { name: string; label?: string } & React.ComponentProps<typeof Textarea>) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          {label ? <Label htmlFor={name}>{label}</Label> : null}
          <Textarea id={name} {...field} {...props} error={fieldState.error?.message} />
        </div>
      )}
    />
  );
}
