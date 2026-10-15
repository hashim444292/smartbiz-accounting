import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isValidJwt(token?: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return false; // Token expired
    }
    return Boolean(payload.userId && payload.role);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawToken = request.cookies.get("sb_auth_token")?.value;
  const isAuthenticated = isValidJwt(rawToken);

  // 1. Allow Next.js internals, static assets, and images
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 2. Publicly accessible APIs (healthcheck, login, public FBR receipt verification)
  const isPublicApi =
    pathname === "/api/health" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/api/verify");

  // 3. Publicly accessible pages (login page, public FBR invoice QR verify page)
  const isLoginPage = pathname === "/login";
  const isPublicPage = pathname.startsWith("/verify");

  // 4. Protect all API endpoints from direct unauthorized access
  if (pathname.startsWith("/api/")) {
    if (!isAuthenticated && !isPublicApi) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Authentication required. Please sign in." },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 5. If user is authenticated and tries to visit /login, redirect to dashboard /
  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 6. Protect all internal pages from unauthenticated access
  if (!isAuthenticated && !isLoginPage && !isPublicPage) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    if (rawToken && !isAuthenticated) {
      // Clear expired / invalid token
      response.cookies.delete("sb_auth_token");
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
