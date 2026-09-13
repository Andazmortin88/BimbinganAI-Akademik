import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next")?.startsWith("/") ? url.searchParams.get("next")! : "/dashboard";
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.redirect(new URL("/?auth_error=1", url.origin));

  const sql = getSql();
  let rows = await sql`
    SELECT p.role::text AS role, p.status::text AS status,
           EXISTS (SELECT 1 FROM public.student_profiles s WHERE s.profile_id = p.id) AS has_student
    FROM public.profiles p
    WHERE p.auth_user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
  let profile = rows[0] as { role: string; status: string; has_student: boolean } | undefined;

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!profile && adminEmail && session.user.email?.toLowerCase() === adminEmail) {
    await sql`
      INSERT INTO public.profiles (id, auth_user_id, role, status, full_name, email, avatar_url)
      VALUES (
        ${session.user.id}::uuid,
        ${session.user.id}::uuid,
        'ADMIN',
        'ACTIVE',
        ${session.user.name || "Administrator"},
        ${session.user.email},
        ${session.user.image ?? null}
      )
      ON CONFLICT (id) DO UPDATE
      SET role = 'ADMIN', status = 'ACTIVE', full_name = EXCLUDED.full_name,
          email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url, updated_at = now()
    `;
    rows = await sql`
      SELECT role::text AS role, status::text AS status, false AS has_student
      FROM public.profiles WHERE auth_user_id = ${session.user.id}::uuid LIMIT 1
    `;
    profile = rows[0] as { role: string; status: string; has_student: boolean } | undefined;
  }

  if (!profile || (profile.role === "STUDENT" && !profile.has_student)) {
    return NextResponse.redirect(new URL("/register", url.origin));
  }
  if (profile.role === "STUDENT" && profile.status === "PENDING") {
    return NextResponse.redirect(new URL("/pending", url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
