"use client";

import { useEffect } from "react";

export function HmrOverlay() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const OriginalEventSource = window.EventSource;
    if (OriginalEventSource) {
      window.EventSource = function (url: string, options?: EventSourceInit) {
        const es = new OriginalEventSource(url, options);
        if (url && (url.indexOf("webpack-hmr") !== -1 || url.indexOf("hmr") !== -1)) {
          es.addEventListener("message", function (event) {
            try {
              const data = JSON.parse(event.data);
              if (data.action === "building") {
                showHmrOverlay();
              } else if (
                data.action === "built" ||
                data.action === "sync" ||
                data.action === "still-ok"
              ) {
                hideHmrOverlay();
              }
            } catch (err) {}
          });
          es.addEventListener("error", function () {
            setTimeout(hideHmrOverlay, 3000);
          });
        }
        return es;
      } as any;
      window.EventSource.prototype = OriginalEventSource.prototype;
    }

    const OriginalWebSocket = window.WebSocket;
    if (OriginalWebSocket) {
      window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
        const ws = new OriginalWebSocket(url, protocols);
        if (
          url &&
          (url.toString().indexOf("webpack-hmr") !== -1 ||
            url.toString().indexOf("hmr") !== -1 ||
            url.toString().indexOf("turbopack-hmr") !== -1)
        ) {
          ws.addEventListener("message", function (event) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "building" || data.action === "building") {
                showHmrOverlay();
              } else if (
                data.type === "built" ||
                data.action === "built" ||
                data.type === "sync" ||
                data.action === "sync" ||
                data.type === "still-ok" ||
                data.action === "still-ok"
              ) {
                hideHmrOverlay();
              }
            } catch (err) {}
          });
          ws.addEventListener("close", function () {
            setTimeout(hideHmrOverlay, 3000);
          });
        }
        return ws;
      } as any;
      window.WebSocket.prototype = OriginalWebSocket.prototype;
    }

    let hideTimeout: NodeJS.Timeout | null = null;

    function showHmrOverlay() {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      let overlay = document.getElementById("hmr-compiling-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "hmr-compiling-overlay";
        overlay.style.cssText =
          "position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(244,239,230,0.85);backdrop-filter:blur(8px) saturate(180%);-webkit-backdrop-filter:blur(8px) saturate(180%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;opacity:0;transition:opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1);pointer-events:none;";

        const spinnerContainer = document.createElement("div");
        spinnerContainer.style.cssText =
          "position:relative;width:64px;height:64px;margin-bottom:20px;";

        const spinner = document.createElement("div");
        spinner.style.cssText =
          "box-sizing:border-box;width:64px;height:64px;border:4px solid rgba(78,140,88,0.15);border-radius:50%;border-top-color:#4e8c58;border-right-color:#4e8c58;animation:hmr-spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;";

        const styleTag = document.createElement("style");
        styleTag.textContent =
          "@keyframes hmr-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}@keyframes hmr-pulse{0%,100%{opacity:0.7;transform:scale(0.98);}50%{opacity:1;transform:scale(1.02);}}";
        document.head.appendChild(styleTag);

        spinnerContainer.appendChild(spinner);
        overlay.appendChild(spinnerContainer);

        const text = document.createElement("div");
        text.textContent = "Loading...";
        text.style.cssText =
          "color:#1e1a16;font-family:var(--font-nunito),sans-serif;font-size:1.2rem;font-weight:700;letter-spacing:0.02em;animation:hmr-pulse 1.8s ease-in-out infinite;";
        overlay.appendChild(text);

        const subtext = document.createElement("div");
        subtext.textContent = "";
        subtext.style.cssText =
          "color:rgba(30,26,22,0.65);font-family:var(--font-nunito),sans-serif;font-size:0.85rem;font-weight:600;margin-top:6px;";
        overlay.appendChild(subtext);

        document.body.appendChild(overlay);
        overlay.offsetHeight; // force reflow
      }

      overlay.style.opacity = "1";
      overlay.style.pointerEvents = "auto";
      document.body.style.overflow = "hidden";
    }

    function hideHmrOverlay() {
      if (hideTimeout) return;
      hideTimeout = setTimeout(function () {
        const overlay = document.getElementById("hmr-compiling-overlay");
        if (overlay) {
          overlay.style.opacity = "0";
          overlay.style.pointerEvents = "none";
          document.body.style.overflow = "";
        }
        hideTimeout = null;
      }, 400);
    }
  }, []);

  return null;
}
