"use client";

import { useEffect, useState } from "react";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";

// Configurable via env so deployments can set their own default without a code change.
const ENV_DEFAULT_TITLE = process.env.NEXT_PUBLIC_DEFAULT_BRAND_TITLE ?? "Platform";
const ENV_DEFAULT_TAGLINE = process.env.NEXT_PUBLIC_DEFAULT_BRAND_TAGLINE ?? "Mental Wellness Platform";

export function useHydratedPlatformBranding() {
  const { data } = usePublicPlatformSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Before hydration we can't read localStorage, but we can check if a cached
    // value was written to a CSS variable by PlatformBrandSync on a previous render.
    // Fall back to the env-configured default — never a hardcoded brand name.
    return { brandTitle: ENV_DEFAULT_TITLE, brandTagline: ENV_DEFAULT_TAGLINE, ready: false };
  }

  // After mount, prefer: live DB value → localStorage cache → env default
  const cachedTitle = localStorage.getItem("platform_brand_title")?.trim();
  const cachedTagline = localStorage.getItem("platform_brand_tagline")?.trim();

  return {
    brandTitle: data?.brandTitle?.trim() || cachedTitle || ENV_DEFAULT_TITLE,
    brandTagline: data?.brandTagline?.trim() || cachedTagline || ENV_DEFAULT_TAGLINE,
    ready: true,
  };
}
