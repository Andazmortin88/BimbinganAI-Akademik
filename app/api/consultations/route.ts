import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(3).max(5000),
});

export async function POST(request: NextRequest) {
  const limited=enforceRateLimit(request,"consultations",20,60_000);if(limited)return limited;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  if (viewer.role !== "STUDENT" || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hanya mahasiswa aktif yang dapat membuka konsultasi." }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Subjek dan pesan wajib diisi." }, { status: 400 });

  const sql = getSql();
  const projects = await sql`SELECT id::text FROM public.research_projects WHERE student_id=${viewer.id}::uuid AND archived_at IS NULL LIMIT 1`;
  const projectId = (projects[0] as { id?: string } | undefined)?.id;
  if (!projectId) return NextResponse.json({ error: "Proyek skripsi belum tersedia." }, { status: 409 });
  const threads = await sql`
    INSERT INTO public.guidance_threads (project_id, subject, status, created_by, unread_count_lecturer, last_message_at)
    VALUES (${projectId}::uuid, ${parsed.data.subject}, 'SUBMITTED', ${viewer.id}::uuid, 1, now())
    RETURNING id::text
  `;
  const threadId = (threads[0] as { id: string }).id;
  await sql.transaction((tx) => [
    tx`INSERT INTO public.messages (thread_id, sender_id, body) VALUES (${threadId}::uuid, ${viewer.id}::uuid, ${parsed.data.message})`,
    tx`INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
       SELECT p.id, 'Konsultasi baru', ${`${viewer.fullName}: ${parsed.data.subject}`}, 'CONSULTATION', '/dashboard'
       FROM public.profiles p WHERE p.role='ADMIN' AND p.status='ACTIVE'`,
  ]);
  return NextResponse.json({ ok: true, threadId });
}
