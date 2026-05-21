"use client";

import { useEffect, useState } from "react";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";

const DEFAULT_TITLE = "Azadi Health";
const DEFAULT_TAGLINE = "Mental Wellness Platform";

export function useHydratedPlatformBranding() {
  const { data } = usePublicPlatformSettings();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return { brandTitle: DEFAULT_TITLE, brandTagline: DEFAULT_TAGLINE, ready: false };
  }

  const cachedTitle = localStorage.getItem("platform_brand_title")?.trim();
  const cachedTagline = localStorage.getItem("platform_brand_tagline")?.trim();

  return {
    brandTitle: data?.brandTitle?.trim() || cachedTitle || DEFAULT_TITLE,
    brandTagline: data?.brandTagline?.trim() || cachedTagline || DEFAULT_TAGLINE,
    ready: true,
  };
}
