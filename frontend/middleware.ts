import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_ROLE_KEY, AUTH_TOKEN_KEY } from "@/constants/storage";
import type { Role } from "@/types/role";
import { pathAllowedForRole, normalizePath } from "@/lib/permissions";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/verify",
  "/forgot-password",
  "/onboarding",
]);

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.has(path);
}

export function middleware(request: NextRequest) {
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
    if (token && roleCookie && ["/login", "/register"].includes(path)) {
      const next = request.nextUrl.searchParams.get("next");
      return NextResponse.redirect(new URL(next || "/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!token || !roleCookie) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (!pathAllowedForRole(path, roleCookie)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};
