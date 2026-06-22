import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_ROLE_KEY, AUTH_TOKEN_KEY } from "@/constants/storage";
import type { Role } from "@/types/role";
import { getDefaultPathForRole, pathAllowedForRole, normalizePath } from "@/lib/permissions";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/org-login",
  "/register",
  "/verify",
  "/forgot-password",
  "/onboarding",
  "/maintenance",
]);

/** Login entry points only — maintenance blocks new sign-in, not active sessions. */
const MAINTENANCE_GATE_PATHS = new Set(["/login", "/register", "/org-login"]);

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.has(path);
}

async function fetchMaintenanceMode(): Promise<boolean> {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/platform-settings`, {
      cache: "no-store",
      // Prevent a slow/missing backend from hanging navigation in middleware.
      // 3 s is plenty for a local server; if it's unreachable we bail fast.
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { maintenanceMode?: boolean };
    return Boolean(data.maintenanceMode);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const path = normalizePath(pathname);

  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;
  const roleCookie = request.cookies.get(AUTH_ROLE_KEY)?.value as Role | undefined;

  if (isPublic(path)) {
    if (
      !token &&
      MAINTENANCE_GATE_PATHS.has(path) &&
      (await fetchMaintenanceMode())
    ) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }

    if (token && roleCookie && ["/login", "/org-login", "/register"].includes(path)) {
      const next = request.nextUrl.searchParams.get("next");
      return NextResponse.redirect(new URL(next || getDefaultPathForRole(roleCookie), request.url));
    }
    return NextResponse.next();
  }

  if (!token || !roleCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (roleCookie === "organization" && !path.startsWith("/org")) {
    return NextResponse.redirect(new URL("/org/dashboard", request.url));
  }

  if (!pathAllowedForRole(path, roleCookie)) {
    return NextResponse.redirect(new URL(getDefaultPathForRole(roleCookie), request.url));
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
