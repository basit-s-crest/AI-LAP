"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref
) {
  return (
    <div className="w-full">
      <input
        ref={ref}
        className={cn(
          "w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-sage focus:shadow-[0_0_0_3px_#EBF5EC]",
          error && "border-danger",
          className
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
});
