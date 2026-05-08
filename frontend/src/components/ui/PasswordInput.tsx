"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, error, ...props }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="w-full">
        <div className="relative">
          <input
            ref={ref}
            type={show ? "text" : "password"}
            className={cn(
              "w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3.5 py-2.5 pr-10 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-sage focus:shadow-[0_0_0_3px_#EBF5EC]",
              error && "border-danger",
              className
            )}
            {...props}
          />
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dim hover:text-mid"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    );
  }
);
