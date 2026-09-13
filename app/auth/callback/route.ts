import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/dashboard";
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.redirect(new URL("/?auth_error=1", url.origin));

  const sql = getSql();
  const rows = await sql`
    SELECT p.role::text AS role, p.status::text AS status,
           EXISTS (SELECT 1 FROM public.student_profiles s WHERE s.profile_id = p.id) AS has_student
    FROM public.profiles p
    WHERE p.auth_user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
  const profile = rows[0] as { role: string; status: string; has_student: boolean } | undefined;

  if (!profile || (profile.role === "STUDENT" && !profile.has_student)) {
    return NextResponse.redirect(new URL("/register", url.origin));
  }
  if (profile.role === "STUDENT" && profile.status === "PENDING") {
    return NextResponse.redirect(new URL("/pending", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
