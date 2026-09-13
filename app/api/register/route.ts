import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(150),
  nim: z.string().trim().min(3).max(30),
  whatsapp: z.string().trim().min(8).max(25),
  program: z.enum(["S1", "D3", "NERS"]),
  cohort: z.number().int().min(2000).max(2100),
  className: z.string().trim().min(1).max(50),
  title: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login ulang." }, { status: 401 });
  }

  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data registrasi belum lengkap atau tidak valid." }, { status: 400 });
  }

  const userId = session.user.id;
  const email = session.user.email;
  if (!email) return NextResponse.json({ error: "Email akun tidak tersedia." }, { status: 400 });

  const input = parsed.data;
  const workType = input.program === "S1" ? "SKRIPSI" : input.program === "D3" ? "KTI" : "KIA";
  const sql = getSql();

  try {
    await sql.transaction((tx) => [
      tx`INSERT INTO public.profiles (id, auth_user_id, role, status, full_name, email, avatar_url)
         VALUES (${userId}::uuid, ${userId}::uuid, 'STUDENT', 'PENDING', ${input.fullName}, ${email}, ${session.user.image ?? null})
         ON CONFLICT (id) DO UPDATE
         SET auth_user_id = EXCLUDED.auth_user_id,
             full_name = EXCLUDED.full_name,
             email = EXCLUDED.email,
             avatar_url = EXCLUDED.avatar_url,
             updated_at = now()`,
      tx`INSERT INTO public.student_profiles
           (profile_id, nim, whatsapp, program, cohort, class_name, work_type, academic_period_id)
         VALUES (
           ${userId}::uuid, ${input.nim}, ${input.whatsapp}, ${input.program}::public.program_code,
           ${input.cohort}, ${input.className}, ${workType}::public.work_type,
           (SELECT id FROM public.academic_periods WHERE is_active = true LIMIT 1)
         )
         ON CONFLICT (profile_id) DO UPDATE
         SET nim = EXCLUDED.nim,
             whatsapp = EXCLUDED.whatsapp,
             program = EXCLUDED.program,
             cohort = EXCLUDED.cohort,
             class_name = EXCLUDED.class_name,
             work_type = EXCLUDED.work_type,
             academic_period_id = EXCLUDED.academic_period_id,
             updated_at = now()`,
      tx`INSERT INTO public.research_projects (student_id, title, created_by)
         VALUES (${userId}::uuid, ${input.title || null}, ${userId}::uuid)
         ON CONFLICT (student_id) DO UPDATE
         SET title = COALESCE(EXCLUDED.title, public.research_projects.title),
             updated_at = now()`,
    ]);
  } catch (error) {
    console.error("registration_failed", error);
    return NextResponse.json({ error: "Registrasi gagal disimpan. Periksa kembali NIM dan data Anda." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, redirectTo: "/pending" });
}
