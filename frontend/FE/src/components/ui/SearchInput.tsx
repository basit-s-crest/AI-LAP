"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export const SearchInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function SearchInput({ className, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
      <input
        ref={ref}
        type="search"
        className="w-full rounded-[9px] border-[1.5px] border-[rgba(60,50,40,0.12)] bg-card py-2.5 pl-9 pr-3 text-[13.5px] outline-none focus:border-sage"
        {...props}
      />
    </div>
  );
});
