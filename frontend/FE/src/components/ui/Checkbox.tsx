"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref
) {
  const cid = id ?? props.name;
  return (
    <label htmlFor={cid} className="inline-flex cursor-pointer items-center gap-2">
      <input
        ref={ref}
        id={cid}
        type="checkbox"
        className={cn("h-4 w-4 accent-sage", className)}
        {...props}
      />
      {label ? <span className="text-sm text-mid">{label}</span> : null}
    </label>
  );
});
