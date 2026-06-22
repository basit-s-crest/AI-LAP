import axios from "axios";
import { AUTH_TOKEN_KEY, AUTH_ROLE_KEY, AUTH_USER_JSON_KEY, AUTH_USER_NAME_KEY } from "@/constants/storage";

/**
 * Resolves the API URL for cross-device access (e.g. mobile accessing PC's backend over hotspot).
 *
 * ONLY replaces `localhost`/`127.0.0.1` in the URL when ALL of these are true:
 *   1. We're running in the browser (not SSR).
 *   2. The browser's hostname is not a loopback address (user is on a different device or network).
 *   3. The env URL itself still points to localhost (i.e. not already configured with a real IP/host).
 *
 * This prevents the common bug where opening the Next.js dev server via its LAN IP
 * (e.g. http://192.168.x.x:3000) on the same machine caused localhost:4000 to get
 * rewritten to 192.168.x.x:4000 unnecessarily, breaking navigation.
 */
export function resolveApiUrl(url: string): string {
  if (typeof window === "undefined") return url;

  const browserHost = window.location.hostname;
  const isLocalBrowser =
    browserHost === "localhost" ||
    browserHost === "127.0.0.1" ||
    browserHost === "" ;

  // If the browser is on a loopback address, no rewrite needed.
  if (isLocalBrowser) return url;

  // If the configured API URL already points to a non-localhost host, respect it — don't touch it.
  const urlHasLocalhost = /localhost|127\.0\.0\.1/.test(url);
  if (!urlHasLocalhost) return url;

  // Only rewrite if the env URL is localhost-based AND we're on a non-loopback hostname.
  // This means: user is on a genuinely different device (mobile, another laptop) connecting to this PC.
  return url.replace(/(localhost|127\.0\.0\.1)/g, browserHost);
}

const api = axios.create({
  baseURL: resolveApiUrl(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"),
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

/** Flag to prevent 401 interceptor during logout */
let isLoggingOut = false;

export function setLoggingOut(value: boolean) {
  isLoggingOut = value;
}

/** Read a cookie value by name (client-side only). */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const encoded = encodeURIComponent(name);
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${encoded}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

/** Clear all auth cookies on 401. */
function clearAuthCookies() {
  for (const key of [AUTH_TOKEN_KEY, AUTH_ROLE_KEY, AUTH_USER_JSON_KEY, AUTH_USER_NAME_KEY]) {
    document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0`;
  }
}

// ── Request: attach JWT from the safecircle_token cookie ──────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    if (config.baseURL) {
      config.baseURL = resolveApiUrl(config.baseURL);
    }
    const token = getCookie(AUTH_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: normalise errors so callers get a plain Error with a message ───
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 403 with userId means "email not verified" — let the caller handle it
    if (error.response?.status === 403 && error.response?.data?.userId) {
      return Promise.reject(error);
    }

    // 401 anywhere else (expired/missing token) → clear cookies and redirect
    // Skip this during logout to prevent showing 401 error
    if (error.response?.status === 401 && typeof window !== "undefined" && !isLoggingOut) {
      clearAuthCookies();
      window.location.href = "/";
      return Promise.reject(error);
    }

    // Surface the backend's message string as a plain Error
    const message =
      error.response?.data?.message ??
      error.message ??
      "Something went wrong";
    return Promise.reject(new Error(message));
  }
);

export default api;
