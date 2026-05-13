import type { Metadata } from "next";
import { Playfair_Display, Nunito, JetBrains_Mono } from "next/font/google";
import { StoreProvider } from "@/store/provider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthHydrator } from "@/components/auth/AuthHydrator";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { Toaster } from "sonner";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Azadi Health — Mental Wellness Platform",
    template: "%s · Azadi Health",
  },
  description:
    "Culturally responsive mental wellness for marginalized youth — coaching, community, and care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${playfair.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      {/*
        Browser extensions (e.g. ColorZilla injects cz-shortcut-listen on <body>) mutate the DOM
        before React hydrates. suppressHydrationWarning only silences attribute/text mismatches on
        this node — not descendants.
      */}
      <body suppressHydrationWarning>
        <StoreProvider>
          <QueryProvider>
            <NavigationProgress />
            <AuthHydrator />
            {children}
            <Toaster richColors position="top-center" />
          </QueryProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
