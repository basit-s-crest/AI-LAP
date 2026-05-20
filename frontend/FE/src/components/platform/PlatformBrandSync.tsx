"use client";

import { useEffect } from "react";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";

export function PlatformBrandSync() {
  const { data } = usePublicPlatformSettings();

  useEffect(() => {
    if (!data) return;
    const title = data.brandTitle?.trim() || "Azadi Health";
    const tagline = data.brandTagline?.trim() || "Mental Wellness Platform";

    localStorage.setItem("platform_brand_title", title);
    localStorage.setItem("platform_brand_tagline", tagline);

    const root = document.documentElement;
    root.style.setProperty("--brand-title", title);
    root.style.setProperty("--brand-tagline", tagline);
  }, [data]);

  return null;
}
