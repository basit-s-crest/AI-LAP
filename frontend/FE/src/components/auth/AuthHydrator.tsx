"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/hooks/redux";
import { hydrateFromStorage, setSession } from "@/store/slices/authSlice";
import { logout } from "@/store/slices/authSlice";
import type { AuthUser } from "@/types/auth";
import { AUTH_TOKEN_KEY, AUTH_USER_JSON_KEY } from "@/constants/storage";
import api from "@/lib/api";

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
    if (!token || !raw) {
      dispatch(logout());
      return;
    }
    let user: AuthUser;
    try {
      user = JSON.parse(raw) as AuthUser;
      // Hydrate immediately from cookie so UI is not blank
      dispatch(hydrateFromStorage({ token, user }));
    } catch {
      dispatch(logout());
      return;
    }

    // Then fetch fresh name from API and update if changed
    const role = user.role;

    if (role === "user" || role === "member") {
      api.get<{ firstName: string; lastName: string; avatar: string | null }>(
        "/api/auth/profile"
      ).then((res) => {
        const { firstName, lastName, avatar } = res.data;
        if (firstName !== user.firstName || lastName !== user.lastName) {
          dispatch(
            setSession({
              token,
              user: {
                ...user,
                firstName,
                lastName,
                avatarEmoji: avatar ?? user.avatarEmoji,
              },
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
          );
        }
      }).catch(() => {});

    } else if (role === "coach") {
      api.get<{ coach: { name: string; avatar: string | null } }>(
        "/api/coach/profile"
      ).then((res) => {
        const { name, avatar } = res.data.coach;
        const [firstName = "", ...rest] = name.trim().split(" ");
        const lastName = rest.join(" ");
        if (firstName !== user.firstName || lastName !== user.lastName) {
          dispatch(
            setSession({
              token,
              user: {
                ...user,
                firstName,
                lastName,
                avatarEmoji: avatar ?? user.avatarEmoji,
              },
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
          );
        }
      }).catch(() => {});
    }
  }, [dispatch]);

  return null;
}