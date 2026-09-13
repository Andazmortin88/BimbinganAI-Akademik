import { auth } from "@/lib/auth/server";
import { NextRequest } from "next/server";

const requireAuth = auth.middleware({ loginUrl: "/" });

export default function proxy(request: NextRequest) {
  return requireAuth(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/register/:path*", "/pending/:path*"],
};
