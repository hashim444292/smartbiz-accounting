import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("sb_auth_token")?.value;

  // Allow static assets, images, favicons, public APIs, and public invoice verification
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/verify") ||
    pathname.startsWith("/api/verify") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // If hitting root '/' and not authenticated, immediately redirect to /login
  if (pathname === "/" && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If hitting /login and already authenticated, redirect to dashboard /
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect all internal application routes from unauthenticated access
  const isLoginPage = pathname === "/login";
  const isAuthApi = pathname.startsWith("/api/auth");
  const isPublicApi = pathname === "/api/health" || pathname.startsWith("/api/verify");
  const isPublicPage = pathname.startsWith("/verify");

  if (!token && !isLoginPage && !isAuthApi && !isPublicApi && !isPublicPage && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
