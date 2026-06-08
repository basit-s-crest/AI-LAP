import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { StoreProvider } from "@/store/provider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthHydrator } from "@/components/auth/AuthHydrator";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { HmrOverlay } from "@/components/layout/HmrOverlay";
import { PlatformBrandSync } from "@/components/platform/PlatformBrandSync";
import { Toaster } from "sonner";
import "./globals.css";
import "@livekit/components-styles";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  let brandTitle = process.env.NEXT_PUBLIC_DEFAULT_BRAND_TITLE ?? "Platform";
  let brandTagline = process.env.NEXT_PUBLIC_DEFAULT_BRAND_TAGLINE ?? "Mental Wellness Platform";

  try {
    const res = await fetch(`${base}/api/auth/platform-settings`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = (await res.json()) as { brandTitle?: string; brandTagline?: string };
      if (data.brandTitle?.trim()) brandTitle = data.brandTitle.trim();
      if (data.brandTagline?.trim()) brandTagline = data.brandTagline.trim();
    }
  } catch {
    // fall through to env defaults
  }

  return {
    title: {
      default: brandTitle,
      template: `%s · ${brandTitle}`,
    },
    description: `${brandTagline} — culturally responsive coaching, community, and care.`,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${outfit.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head></head>
      {/*
        Browser extensions (e.g. ColorZilla injects cz-shortcut-listen on <body>) mutate the DOM
        before React hydrates. suppressHydrationWarning only silences attribute/text mismatches on
        this node — not descendants.
      */}
      <body suppressHydrationWarning>
        <StoreProvider>
          <QueryProvider>
            <HmrOverlay />
            <PlatformBrandSync />
            <NavigationProgress />
            <AuthHydrator />
            <SessionGuard />
            {children}
            <Toaster richColors position="top-center" />
          </QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
