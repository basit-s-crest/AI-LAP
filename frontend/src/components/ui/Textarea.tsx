"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, ...props },
  ref
) {
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          "min-h-[80px] w-full resize-none rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card px-3.5 py-2.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-dim focus:border-sage focus:shadow-[0_0_0_3px_#EBF5EC]",
          error && "border-danger",
          className
        )}
        {...props}
      />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
});
