"use client";

import { useQuery } from "@tanstack/react-query";

export interface PublicPlatformSettings {
  brandTitle: string;
  brandTagline: string;
  primaryColor: string;
  logoUrl: string | null;
  allowSelfRegistration: boolean;
  maintenanceMode: boolean;
}

export function usePublicPlatformSettings() {
  return useQuery({
    queryKey: ["public-platform-settings"],
    queryFn: async (): Promise<PublicPlatformSettings> => {
      const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/platform-settings`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load platform settings");
      return res.json();
    },
    staleTime: 30_000,
  });
}

