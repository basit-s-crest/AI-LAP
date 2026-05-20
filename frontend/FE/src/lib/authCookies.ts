import { AUTH_TOKEN_KEY, AUTH_USER_JSON_KEY } from "@/constants/storage";

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`)
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/** True when the browser still has an active session cookie pair. */
export function hasAuthCookies(): boolean {
  return Boolean(readCookie(AUTH_TOKEN_KEY) && readCookie(AUTH_USER_JSON_KEY));
}
