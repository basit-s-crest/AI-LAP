"use client";

import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export function RHFInput({
  name,
  label,
  ...props
}: { name: string; label?: string } & React.ComponentProps<typeof Input>) {
  const { control } = useFormContext();
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          {label ? <Label htmlFor={name}>{label}</Label> : null}
          <Input id={name} {...field} {...props} error={fieldState.error?.message} />
        </div>
      )}
    />
  );
}
