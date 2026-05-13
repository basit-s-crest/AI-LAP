"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/hooks/redux";
import { hydrateFromStorage } from "@/store/slices/authSlice";
import type { AuthUser } from "@/types/auth";
import { AUTH_TOKEN_KEY, AUTH_USER_JSON_KEY } from "@/constants/storage";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`)
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthHydrator() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const token = readCookie(AUTH_TOKEN_KEY);
    const raw = readCookie(AUTH_USER_JSON_KEY);
    if (!token || !raw) return;
    try {
      const user = JSON.parse(raw) as AuthUser;
      dispatch(hydrateFromStorage({ token, user }));
    } catch {
      /* ignore */
    }
  }, [dispatch]);
  return null;
}
