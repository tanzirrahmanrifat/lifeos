import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first gate: bounce requests with no session cookie to /login before rendering anything.
 * This is only an optimisation — it cannot validate a session (no database access here). Real
 * authentication happens in the (app) layout and again inside every server action.
 */
const PUBLIC_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];
const COOKIES = ["__Host-lifeos_session", "lifeos_session"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasCookie = COOKIES.some((name) => request.cookies.has(name));

  if (!isPublic && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
