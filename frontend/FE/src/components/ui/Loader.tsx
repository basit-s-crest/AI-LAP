"use client";

import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

export function Loader({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10", className)}>
      <Loader2 className="h-8 w-8 animate-spin text-sage" aria-hidden />
      {label ? <p className="text-sm text-mid">{label}</p> : null}
    </div>
  );
}
