import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ confirmation: z.string().trim().min(1).max(100) });

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "ADMIN" || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hanya administrator aktif yang dapat menghapus data." }, { status: 403 });
  }
  const parsedParams = paramsSchema.safeParse(await context.params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Permintaan penghapusan tidak valid." }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT p.id::text, p.full_name, p.status::text, sp.nim, rp.id::text AS project_id,
           rp.archived_at, rp.current_stage_id
    FROM public.profiles p
    JOIN public.student_profiles sp ON sp.profile_id=p.id
    JOIN public.research_projects rp ON rp.student_id=p.id
    WHERE p.id=${parsedParams.data.id}::uuid AND p.role='STUDENT'
    LIMIT 1
  `;
  const student = rows[0] as {
    id: string; full_name: string; status: string; nim: string; project_id: string;
    archived_at: string | null; current_stage_id: number;
  } | undefined;
  if (!student) return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
  if (student.status !== "COMPLETED" || !student.archived_at || Number(student.current_stage_id) !== 17) {
    return NextResponse.json({ error: "Hanya mahasiswa yang sudah selesai dan diarsipkan yang dapat dihapus." }, { status: 409 });
  }
  if (parsedBody.data.confirmation !== `HAPUS ${student.nim}`) {
    return NextResponse.json({ error: `Ketik tepat: HAPUS ${student.nim}` }, { status: 400 });
  }

  try {
    await sql.transaction((tx) => [
      tx`DELETE FROM public.document_comments WHERE document_version_id IN (
        SELECT v.id FROM public.document_versions v
        JOIN public.documents d ON d.id=v.document_id WHERE d.project_id=${student.project_id}::uuid)`,
      tx`DELETE FROM public.turnitin_records WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.document_versions WHERE document_id IN (
        SELECT id FROM public.documents WHERE project_id=${student.project_id}::uuid)`,
      tx`DELETE FROM public.documents WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.consultation_records WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.messages WHERE thread_id IN (
        SELECT id FROM public.guidance_threads WHERE project_id=${student.project_id}::uuid)`,
      tx`DELETE FROM public.guidance_sessions WHERE thread_id IN (
        SELECT id FROM public.guidance_threads WHERE project_id=${student.project_id}::uuid)`,
      tx`DELETE FROM public.guidance_threads WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.appointments WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.followup_logs WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.generated_reports WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.progress_histories WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.title_submissions WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.exam_eligibility_decisions WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.supervision_assignments WHERE project_id=${student.project_id}::uuid`,
      tx`DELETE FROM public.research_projects WHERE id=${student.project_id}::uuid`,
      tx`DELETE FROM public.notifications WHERE recipient_id=${student.id}::uuid`,
      tx`DELETE FROM public.student_profiles WHERE profile_id=${student.id}::uuid`,
      tx`UPDATE public.profiles SET status='DISABLED', updated_at=now() WHERE id=${student.id}::uuid`,
      tx`INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES (${viewer.id}::uuid, 'PURGE_COMPLETED_STUDENT', 'STUDENT', ${student.id},
           ${JSON.stringify({ fullName: student.full_name, nim: student.nim })}::jsonb)`,
    ]);
  } catch (error) {
    console.error("student_purge_failed", error);
    return NextResponse.json({ error: "Data belum dapat dihapus karena masih memiliki relasi yang dilindungi." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, deletedStudent: student.full_name });
}
