import type { Metadata } from "next";
import { Playfair_Display, Nunito, JetBrains_Mono } from "next/font/google";
import { StoreProvider } from "@/store/provider";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthHydrator } from "@/components/auth/AuthHydrator";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { PlatformBrandSync } from "@/components/platform/PlatformBrandSync";
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
  const isDev = process.env.NODE_ENV === "development";

  return (
    <html
      lang="en"
      className={`${nunito.variable} ${playfair.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        {isDev && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  if (typeof window === 'undefined') return;

                  var OriginalEventSource = window.EventSource;
                  if (OriginalEventSource) {
                    window.EventSource = function(url, options) {
                      var es = new OriginalEventSource(url, options);
                      if (url && (url.indexOf('webpack-hmr') !== -1 || url.indexOf('hmr') !== -1)) {
                        es.addEventListener('message', function(event) {
                          try {
                            var data = JSON.parse(event.data);
                            if (data.action === 'building') {
                              showHmrOverlay();
                            } else if (data.action === 'built' || data.action === 'sync' || data.action === 'still-ok') {
                              hideHmrOverlay();
                            }
                          } catch (err) {}
                        });
                        es.addEventListener('error', function() {
                          setTimeout(hideHmrOverlay, 3000);
                        });
                      }
                      return es;
                    };
                    window.EventSource.prototype = OriginalEventSource.prototype;
                  }

                  var OriginalWebSocket = window.WebSocket;
                  if (OriginalWebSocket) {
                    window.WebSocket = function(url, protocols) {
                      var ws = new OriginalWebSocket(url, protocols);
                      if (url && (url.indexOf('webpack-hmr') !== -1 || url.indexOf('hmr') !== -1 || url.indexOf('turbopack-hmr') !== -1)) {
                        ws.addEventListener('message', function(event) {
                          try {
                            var data = JSON.parse(event.data);
                            if (data.type === 'building' || data.action === 'building') {
                              showHmrOverlay();
                            } else if (
                              data.type === 'built' || data.action === 'built' ||
                              data.type === 'sync' || data.action === 'sync' ||
                              data.type === 'still-ok' || data.action === 'still-ok'
                            ) {
                              hideHmrOverlay();
                            }
                          } catch (err) {}
                        });
                        ws.addEventListener('close', function() {
                          setTimeout(hideHmrOverlay, 3000);
                        });
                      }
                      return ws;
                    };
                    window.WebSocket.prototype = OriginalWebSocket.prototype;
                  }

                  var hideTimeout = null;

                  function showHmrOverlay() {
                    if (hideTimeout) {
                      clearTimeout(hideTimeout);
                      hideTimeout = null;
                    }
                    
                    var overlay = document.getElementById('hmr-compiling-overlay');
                    if (!overlay) {
                      overlay = document.createElement('div');
                      overlay.id = 'hmr-compiling-overlay';
                      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(244,239,230,0.85);backdrop-filter:blur(8px) saturate(180%);-webkit-backdrop-filter:blur(8px) saturate(180%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;opacity:0;transition:opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);pointer-events:none;';
                      
                      var spinnerContainer = document.createElement('div');
                      spinnerContainer.style.cssText = 'position:relative;width:64px;height:64px;margin-bottom:20px;';
                      
                      var spinner = document.createElement('div');
                      spinner.style.cssText = 'box-sizing:border-box;width:64px;height:64px;border:4px solid rgba(78,140,88,0.15);border-radius:50%;border-top-color:#4e8c58;border-right-color:#4e8c58;animation:hmr-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;';
                      
                      var styleTag = document.createElement('style');
                      styleTag.textContent = "@keyframes hmr-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}@keyframes hmr-pulse{0%,100%{opacity:0.7;transform:scale(0.98);}50%{opacity:1;transform:scale(1.02);}}";
                      document.head.appendChild(styleTag);
                      
                      spinnerContainer.appendChild(spinner);
                      overlay.appendChild(spinnerContainer);
                      
                      var text = document.createElement('div');
                      text.textContent = 'Loading...';
                      text.style.cssText = 'color:#1e1a16;font-family:var(--font-nunito),sans-serif;font-size:1.2rem;font-weight:700;letter-spacing:0.02em;animation:hmr-pulse 1.8s ease-in-out infinite;';
                      overlay.appendChild(text);
                      
                      var subtext = document.createElement('div');
                      subtext.textContent = '';
                      subtext.style.cssText = 'color:rgba(30,26,22,0.65);font-family:var(--font-nunito),sans-serif;font-size:0.85rem;font-weight:600;margin-top:6px;';
                      overlay.appendChild(subtext);
                      
                      document.body.appendChild(overlay);
                      overlay.offsetHeight; // force reflow
                    }
                    
                    overlay.style.opacity = '1';
                    overlay.style.pointerEvents = 'auto';
                    document.body.style.overflow = 'hidden';
                  }

                  function hideHmrOverlay() {
                    if (hideTimeout) return;
                    hideTimeout = setTimeout(function() {
                      var overlay = document.getElementById('hmr-compiling-overlay');
                      if (overlay) {
                        overlay.style.opacity = '0';
                        overlay.style.pointerEvents = 'none';
                        document.body.style.overflow = '';
                      }
                      hideTimeout = null;
                    }, 400);
                  }
                })();
              `,
            }}
          />
        )}
      </head>
      {/*
        Browser extensions (e.g. ColorZilla injects cz-shortcut-listen on <body>) mutate the DOM
        before React hydrates. suppressHydrationWarning only silences attribute/text mismatches on
        this node — not descendants.
      */}
      <body suppressHydrationWarning>
        <StoreProvider>
          <QueryProvider>
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
