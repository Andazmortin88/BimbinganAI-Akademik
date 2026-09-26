import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sendAdminWhatsAppNotification } from "@/lib/whatsapp";

const schema = z.object({ message: z.string().trim().min(1).max(5000) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, "messages", 60, 60_000);
  if (limited) return limited;

  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  }

  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!/^[0-9a-f-]{36}$/i.test(id) || !parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
  }

  const sql = getSql();
  const allowed = await sql`
    SELECT
      gt.id::text,
      gt.subject,
      rp.id::text AS project_id,
      rp.student_id::text,
      student.full_name AS student_name
    FROM public.guidance_threads gt
    JOIN public.research_projects rp ON rp.id = gt.project_id
    JOIN public.profiles student ON student.id = rp.student_id
    WHERE gt.id = ${id}::uuid
      AND (
        ${viewer.role === "ADMIN"}
        OR rp.student_id = ${viewer.id}::uuid
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

  const thread = allowed[0] as
    | { project_id: string; student_id: string; student_name: string; subject: string }
    | undefined;
  if (!thread) {
    return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
  }

  const fromStudent = viewer.role === "STUDENT";
  const status = fromStudent ? "SUBMITTED" : "IN_REVIEW";

  try {
    await sql.transaction((tx) => [
      tx`
        INSERT INTO public.messages (thread_id, sender_id, body)
        VALUES (${id}::uuid, ${viewer.id}::uuid, ${parsed.data.message})
      `,
      tx`
        UPDATE public.guidance_threads
        SET status = ${status}::public.review_status,
            updated_at = now(),
            last_message_at = now(),
            unread_count_student = CASE
              WHEN ${fromStudent} THEN 0
              ELSE unread_count_student + 1
            END,
            unread_count_lecturer = CASE
              WHEN ${fromStudent} THEN unread_count_lecturer + 1
              ELSE 0
            END
        WHERE id = ${id}::uuid
      `,
      fromStudent
        ? tx`
            INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
            SELECT recipient_id,
                   'Balasan konsultasi',
                   ${`${viewer.fullName}: ${thread.subject}`},
                   'CONSULTATION',
                   '/dashboard'
            FROM (
              SELECT p.id AS recipient_id
              FROM public.profiles p
              WHERE p.role = 'ADMIN' AND p.status = 'ACTIVE'
              UNION
              SELECT sa.lecturer_id AS recipient_id
              FROM public.supervision_assignments sa
              JOIN public.profiles p ON p.id = sa.lecturer_id
              WHERE sa.project_id = ${thread.project_id}::uuid
                AND sa.is_active
                AND p.status = 'ACTIVE'
            ) recipients
            WHERE recipient_id <> ${viewer.id}::uuid
          `
        : tx`
            INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
            VALUES (
              ${thread.student_id}::uuid,
              'Balasan konsultasi dari dosen',
              ${`${viewer.fullName}: ${thread.subject}`},
              'CONSULTATION',
              '/dashboard'
            )
          `,
    ]);
  } catch (error) {
    console.error("consultation_message_failed", error);
    return NextResponse.json({ error: "Pesan belum dapat dikirim. Silakan coba kembali." }, { status: 500 });
  }

  if (fromStudent) {
    await sendAdminWhatsAppNotification({
      title: "Pesan konsultasi baru",
      body: `${thread.student_name} — ${thread.subject}: ${parsed.data.message.slice(0, 1200)}`,
    });
  }

  return NextResponse.json({ ok: true });
}
