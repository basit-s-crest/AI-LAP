"use client";

import { useEffect } from "react";
import { usePublicPlatformSettings } from "@/hooks/usePublicPlatformSettings";

// Env-level fallback — only used when the DB hasn't responded yet.
const ENV_DEFAULT_TITLE = process.env.NEXT_PUBLIC_DEFAULT_BRAND_TITLE ?? "";
const ENV_DEFAULT_TAGLINE = process.env.NEXT_PUBLIC_DEFAULT_BRAND_TAGLINE ?? "";

export function PlatformBrandSync() {
  const { data } = usePublicPlatformSettings();

  useEffect(() => {
    if (!data) return;

    // DB value is the single source of truth — no hardcoded brand name fallback.
    const title = data.brandTitle?.trim() || ENV_DEFAULT_TITLE;
    const tagline = data.brandTagline?.trim() || ENV_DEFAULT_TAGLINE;

    if (title) localStorage.setItem("platform_brand_title", title);
    if (tagline) localStorage.setItem("platform_brand_tagline", tagline);

    const root = document.documentElement;
    if (title) root.style.setProperty("--brand-title", title);
    if (tagline) root.style.setProperty("--brand-tagline", tagline);
  }, [data]);

  return null;
}
