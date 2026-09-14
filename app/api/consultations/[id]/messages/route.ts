import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ message: z.string().trim().min(1).max(5000) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited=enforceRateLimit(request,"messages",60,60_000);if(limited)return limited;
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE") return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });

  const sql = getSql();
  const allowed = await sql`
    SELECT gt.id, rp.student_id::text
    FROM public.guidance_threads gt JOIN public.research_projects rp ON rp.id=gt.project_id
    WHERE gt.id=${id}::uuid AND (
      ${viewer.role === "ADMIN"}
      OR rp.student_id=${viewer.id}::uuid
      OR EXISTS (SELECT 1 FROM public.supervision_assignments sa WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)
    ) LIMIT 1
  `;
  if (!allowed[0]) return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
  const status = viewer.role === "STUDENT" ? "SUBMITTED" : "IN_REVIEW";
  await sql.transaction((tx) => [
    tx`INSERT INTO public.messages (thread_id, sender_id, body) VALUES (${id}::uuid, ${viewer.id}::uuid, ${parsed.data.message})`,
    tx`UPDATE public.guidance_threads SET status=${status}::public.review_status, updated_at=now(), last_message_at=now(),
       unread_count_student=CASE WHEN ${viewer.role === "STUDENT"} THEN 0 ELSE unread_count_student+1 END,
       unread_count_lecturer=CASE WHEN ${viewer.role === "STUDENT"} THEN unread_count_lecturer+1 ELSE 0 END
       WHERE id=${id}::uuid`,
    tx`INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
       SELECT CASE WHEN ${viewer.role === "STUDENT"} THEN p.id ELSE ${(allowed[0] as { student_id: string }).student_id}::uuid END,
              'Balasan konsultasi', ${`${viewer.fullName} mengirim balasan.`}, 'CONSULTATION', '/dashboard'
       FROM public.profiles p
       WHERE (${viewer.role === "STUDENT"} AND p.role='ADMIN' AND p.status='ACTIVE')
          OR (NOT ${viewer.role === "STUDENT"} AND p.id=${(allowed[0] as { student_id: string }).student_id}::uuid)`,
  ]);
  return NextResponse.json({ ok: true });
}
