"use client";

import { cn } from "@/lib/cn";

export interface RadioOption {
  value: string;
  label: string;
}

export interface RadioGroupFieldProps {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: RadioOption[];
  className?: string;
}

export function RadioGroupField({
  name,
  value,
  onChange,
  options,
  className,
}: RadioGroupFieldProps) {
  return (
    <div className={cn("space-y-2", className)} role="radiogroup">
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-[9px] border-[1.5px] px-3 py-2 text-sm",
              checked
                ? "border-sage bg-sage-tint"
                : "border-[rgba(60,50,40,0.12)] bg-card hover:border-[rgba(60,50,40,0.22)]"
            )}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border",
                checked ? "border-sage bg-sage" : "border-dim"
              )}
            >
              {checked ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
            </span>
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
