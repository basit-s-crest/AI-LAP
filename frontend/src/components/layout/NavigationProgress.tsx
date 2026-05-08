"use client";

import NextTopLoader from "nextjs-toploader";

/** Thin top bar during App Router navigations (NProgress-style). */
export function NavigationProgress() {
  return (
    <NextTopLoader
      color="#4E8C58"
      initialPosition={0.08}
      crawlSpeed={200}
      height={3}
      crawl
      showSpinner={false}
      easing="ease"
      speed={200}
      shadow="0 0 12px rgba(78, 140, 88, 0.45), 0 0 6px rgba(78, 140, 88, 0.25)"
      zIndex={99999}
    />
  );
}
