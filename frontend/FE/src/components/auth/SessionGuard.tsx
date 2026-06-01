"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/hooks/redux";
import { logout } from "@/store/slices/authSlice";
import { hasAuthCookies } from "@/lib/authCookies";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/org-login",
  "/register",
  "/verify",
  "/forgot-password",
  "/onboarding",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return false;
}

/**
 * Re-validates session on load and when the browser restores a bfcache page (Back button).
 * Prevents showing a stale dashboard after logout or after switching accounts.
 */
export function SessionGuard() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const reduxUser = useAppSelector((s) => s.auth.user);

  const verifySession = useCallback(() => {
    const authed = hasAuthCookies();

    if (!authed) {
      if (reduxUser) dispatch(logout());
      if (!isPublicPath(pathname)) {
        router.replace("/");
      }
      return;
    }
  }, [dispatch, pathname, reduxUser, router]);

  useEffect(() => {
    verifySession();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) verifySession();
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [verifySession]);

  return null;
}
