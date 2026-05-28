import axios from "axios";
import { AUTH_TOKEN_KEY, AUTH_ROLE_KEY, AUTH_USER_JSON_KEY, AUTH_USER_NAME_KEY } from "@/constants/storage";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
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

// ── Request: attach JWT from the azadi_token cookie ──────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
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
      window.location.href = "/login";
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
