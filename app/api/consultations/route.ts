import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendAdminWhatsAppNotification } from "@/lib/whatsapp";

const schema = z.object({
  studentId: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(3).max(5000),
});

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, "consultations", 20, 60_000);
  if (limited) return limited;

  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mahasiswa, subjek, atau pesan tidak valid." }, { status: 400 });
  }

  const sql = getSql();
  let projectId: string | undefined;
  let studentId: string | undefined;
  let studentName: string | undefined;

  if (viewer.role === "STUDENT") {
    const rows = await sql`
      SELECT rp.id::text, p.id::text AS student_id, p.full_name AS student_name
      FROM public.research_projects rp
      JOIN public.profiles p ON p.id = rp.student_id
      WHERE rp.student_id = ${viewer.id}::uuid
        AND rp.archived_at IS NULL
      LIMIT 1
    `;
    const row = rows[0] as { id?: string; student_id?: string; student_name?: string } | undefined;
    projectId = row?.id;
    studentId = row?.student_id;
    studentName = row?.student_name;
  } else if (viewer.role === "ADMIN" || viewer.role === "LECTURER") {
    if (!parsed.data.studentId) {
      return NextResponse.json({ error: "Pilih mahasiswa terlebih dahulu." }, { status: 400 });
    }

    const rows = await sql`
      SELECT rp.id::text, p.id::text AS student_id, p.full_name AS student_name
      FROM public.research_projects rp
      JOIN public.profiles p ON p.id = rp.student_id
      WHERE p.id = ${parsed.data.studentId}::uuid
        AND p.role = 'STUDENT'
        AND p.status = 'ACTIVE'
        AND rp.archived_at IS NULL
        AND (
          ${viewer.role === "ADMIN"}
          OR EXISTS (
            SELECT 1
            FROM public.supervision_assignments sa
            WHERE sa.project_id = rp.id
              AND sa.lecturer_id = ${viewer.id}::uuid
              AND sa.is_active
          )
        )
      LIMIT 1
    `;
    const row = rows[0] as { id?: string; student_id?: string; student_name?: string } | undefined;
    projectId = row?.id;
    studentId = row?.student_id;
    studentName = row?.student_name;
  } else {
    return NextResponse.json({ error: "Peran akun tidak dapat membuka konsultasi." }, { status: 403 });
  }

  if (!projectId || !studentId) {
    return NextResponse.json(
      { error: viewer.role === "STUDENT" ? "Proyek skripsi belum tersedia." : "Mahasiswa atau proyek bimbingan tidak ditemukan." },
      { status: viewer.role === "STUDENT" ? 409 : 404 },
    );
  }

  const threadId = randomUUID();
  const fromStudent = viewer.role === "STUDENT";
  const status = fromStudent ? "SUBMITTED" : "IN_REVIEW";

  try {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO public.guidance_threads
          (id, project_id, subject, status, created_by, unread_count_student, unread_count_lecturer, last_message_at)
        VALUES
          (${threadId}::uuid, ${projectId}::uuid, ${parsed.data.subject},
           ${status}::public.review_status, ${viewer.id}::uuid,
           ${fromStudent ? 0 : 1}, ${fromStudent ? 1 : 0}, now())
      `,
      tx`
        INSERT INTO public.messages (thread_id, sender_id, body)
        VALUES (${threadId}::uuid, ${viewer.id}::uuid, ${parsed.data.message})
      `,
      fromStudent
        ? tx`
            INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
            SELECT recipient_id, 'Konsultasi baru',
                   ${`${viewer.fullName}: ${parsed.data.subject}`},
                   'CONSULTATION', '/dashboard'
            FROM (
              SELECT p.id AS recipient_id
              FROM public.profiles p
              WHERE p.role = 'ADMIN' AND p.status = 'ACTIVE'
              UNION
              SELECT sa.lecturer_id AS recipient_id
              FROM public.supervision_assignments sa
              JOIN public.profiles p ON p.id = sa.lecturer_id
              WHERE sa.project_id = ${projectId}::uuid
                AND sa.is_active
                AND p.status = 'ACTIVE'
            ) recipients
            WHERE recipient_id <> ${viewer.id}::uuid
          `
        : tx`
            INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
            VALUES (
              ${studentId}::uuid,
              'Konsultasi baru dari dosen',
              ${`${viewer.fullName}: ${parsed.data.subject}`},
              'CONSULTATION',
              '/dashboard'
            )
          `,
    ]);
  } catch (error) {
    console.error("consultation_create_failed", error);
    return NextResponse.json({ error: "Konsultasi belum dapat disimpan. Silakan coba kembali." }, { status: 500 });
  }

  if (fromStudent) {
    await sendAdminWhatsAppNotification({
      title: "Konsultasi baru",
      body: `${studentName || viewer.fullName} — ${parsed.data.subject}: ${parsed.data.message.slice(0, 1200)}`,
    });
  }

  return NextResponse.json({ ok: true, threadId });
}
