"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { parseActiveView, type ActiveView } from "@/lib/activeView";

export function useActiveView(): ActiveView {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return useMemo(
    () => parseActiveView(pathname, searchParams),
    [pathname, searchParams]
  );
}
