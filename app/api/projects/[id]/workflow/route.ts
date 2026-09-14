import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_ELIGIBILITY"),
    examType: z.enum(["PROPOSAL", "RESULT"]),
    decision: z.enum(["NOT_YET", "ELIGIBLE"]),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal("COMPLETE_AND_ARCHIVE") }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE" || !["ADMIN", "LECTURER"].includes(viewer.role)) {
    return NextResponse.json({ error: "Akses dosen atau administrator diperlukan." }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const sql = getSql();
  const projects = await sql`
    SELECT rp.id::text, rp.student_id::text, p.full_name
    FROM public.research_projects rp
    JOIN public.profiles p ON p.id=rp.student_id
    WHERE rp.id=${parsedParams.data.id}::uuid
      AND (
        ${viewer.role === "ADMIN"}
        OR EXISTS (
          SELECT 1 FROM public.supervision_assignments sa
          WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active
        )
      )
    LIMIT 1
  `;
  const project = projects[0] as { id: string; student_id: string; full_name: string } | undefined;
  if (!project) return NextResponse.json({ error: "Proyek mahasiswa tidak ditemukan." }, { status: 404 });

  if (parsedBody.data.action === "SET_ELIGIBILITY") {
    const { examType, decision, notes } = parsedBody.data;
    await sql.transaction((tx) => [
      tx`INSERT INTO public.exam_eligibility_decisions
           (project_id, exam_type, decision, notes, decided_by)
         VALUES (${project.id}::uuid, ${examType}, ${decision}, ${notes || null}, ${viewer.id}::uuid)
         ON CONFLICT (project_id, exam_type) DO UPDATE
         SET decision=EXCLUDED.decision, notes=EXCLUDED.notes, decided_by=EXCLUDED.decided_by,
             decided_at=now(), updated_at=now()`,
      tx`INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
         VALUES (${project.student_id}::uuid, 'Keputusan kelayakan ujian',
           ${`${examType === "PROPOSAL" ? "Ujian proposal" : "Ujian hasil"}: ${decision === "ELIGIBLE" ? "Layak" : "Belum layak"}`},
           'EXAM_ELIGIBILITY', '/dashboard')`,
    ]);
    return NextResponse.json({ ok: true, examType, decision });
  }

  if (viewer.role !== "ADMIN") {
    return NextResponse.json({ error: "Hanya administrator yang dapat menyelesaikan dan mengarsipkan mahasiswa." }, { status: 403 });
  }

  const resultEligibility = await sql`
    SELECT decision FROM public.exam_eligibility_decisions
    WHERE project_id=${project.id}::uuid AND exam_type='RESULT' LIMIT 1
  `;
  if ((resultEligibility[0] as { decision?: string } | undefined)?.decision !== "ELIGIBLE") {
    return NextResponse.json({ error: "Mahasiswa harus dinyatakan layak ujian hasil sebelum diselesaikan." }, { status: 409 });
  }

  await sql.transaction((tx) => [
    tx`UPDATE public.research_projects
       SET current_stage_id=17, archived_at=COALESCE(archived_at, now()), archived_by=${viewer.id}::uuid, updated_at=now()
       WHERE id=${project.id}::uuid`,
    tx`UPDATE public.profiles SET status='COMPLETED', updated_at=now() WHERE id=${project.student_id}::uuid`,
    tx`INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
       VALUES (${project.student_id}::uuid, 'Bimbingan selesai',
         'Proyek akademik Anda telah ditandai selesai dan masuk ke arsip.', 'PROJECT_COMPLETED', '/dashboard')`,
  ]);
  return NextResponse.json({ ok: true, status: "COMPLETED" });
}
