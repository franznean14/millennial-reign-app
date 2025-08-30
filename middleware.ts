import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow health checks/ping to pass through
  if (pathname === "/__ping" || pathname.startsWith("/__ping/") || pathname === "/ping" || pathname.startsWith("/ping/")) {
    return NextResponse.next();
  }

  // Heuristic: Supabase sets cookies containing 'sb-' and '-auth-token' with JSON value including access_token
  const authCookie = req.cookies
    .getAll()
    .find((c) => c.name.includes("sb-") && c.name.endsWith("-auth-token"));
  let hasAuthCookie = false;
  if (authCookie?.value) {
    try {
      const parsed = JSON.parse(authCookie.value);
      hasAuthCookie = typeof parsed?.access_token === "string" && parsed.access_token.length > 10;
    } catch {
      hasAuthCookie = false;
    }
  }

  if (!hasAuthCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Prevent accessing /login when already authenticated
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip middleware for static assets and public files so resources like
  // the manifest and icons are available on first paint.
  matcher: [
    "/((?!api|__ping|ping|_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|manifest.webmanifest|apple-touch-icon.png|safari-pinned-tab.svg|icons|sw.js).*)",
  ],
};
