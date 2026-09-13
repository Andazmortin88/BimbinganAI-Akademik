import { auth } from "@/lib/auth/server";
import { NextRequest, NextResponse } from "next/server";

const requireAuth = auth.middleware({ loginUrl: "/" });

export default function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/dashboard") &&
    request.nextUrl.searchParams.get("demo") === "1"
  ) {
    return NextResponse.next();
  }

  return requireAuth(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/register/:path*", "/pending/:path*"],
};
