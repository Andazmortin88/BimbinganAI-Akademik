import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const submitSchema = z.object({
  title: z.string().trim().min(20, "Judul minimal 20 karakter.").max(500),
  background: z.string().trim().min(100, "Latar belakang minimal 100 karakter.").max(10000),
  researchProblem: z.string().trim().min(20, "Rumusan masalah minimal 20 karakter.").max(3000),
  objective: z.string().trim().min(20, "Tujuan penelitian minimal 20 karakter.").max(3000),
  proposedMethod: z.string().trim().max(2000).optional(),
  initialReferences: z.string().trim().max(10000).optional(),
});

const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["APPROVED", "REVISION", "REJECTED"]),
  reason: z.string().trim().min(5).max(3000),
});

export async function POST(request: NextRequest) {
  const limited=enforceRateLimit(request,"titles",10,60_000);if(limited)return limited;
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "STUDENT" || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hanya mahasiswa aktif yang dapat mengajukan judul." }, { status: 403 });
  }
  const parsed = submitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Data judul belum lengkap." }, { status: 400 });

  const sql = getSql();
  const projects = await sql`SELECT id::text FROM public.research_projects WHERE student_id=${viewer.id}::uuid AND archived_at IS NULL LIMIT 1`;
  const projectId = (projects[0] as { id?: string } | undefined)?.id;
  if (!projectId) return NextResponse.json({ error: "Proyek skripsi belum tersedia." }, { status: 409 });

  const existing = await sql`SELECT count(*)::int AS total, bool_or(decision IN ('PENDING','APPROVED')) AS has_active FROM public.title_submissions WHERE project_id=${projectId}::uuid`;
  const summary = existing[0] as { total: number; has_active: boolean };
  if (summary.has_active) return NextResponse.json({ error: "Masih ada pengajuan judul yang sedang diproses atau telah disetujui." }, { status: 409 });
  if (summary.total >= 3) return NextResponse.json({ error: "Batas tiga pengajuan judul telah tercapai. Hubungi dosen untuk membuka revisi." }, { status: 409 });

  const data = parsed.data;
  const rows = await sql`
    INSERT INTO public.title_submissions
      (project_id, sequence_no, title, background, research_problem, objective, proposed_method, initial_references, created_by)
    VALUES (${projectId}::uuid, ${summary.total + 1}, ${data.title}, ${data.background}, ${data.researchProblem}, ${data.objective}, ${data.proposedMethod || null}, ${data.initialReferences || null}, ${viewer.id}::uuid)
    RETURNING id::text
  `;
  const id = String(rows[0].id);
  await Promise.all([
    writeAudit(sql, { actorId: viewer.id, action: "TITLE_SUBMITTED", entityType: "title_submission", entityId: id }),
    sql`INSERT INTO public.notifications (recipient_id,title,body,type,target_url)
        SELECT DISTINCT p.id, 'Pengajuan judul baru', ${`${viewer.fullName} mengajukan judul skripsi.`}, 'TITLE_SUBMITTED', '/dashboard'
        FROM public.profiles p
        WHERE p.status='ACTIVE' AND (p.role='ADMIN' OR EXISTS (
          SELECT 1 FROM public.supervision_assignments sa WHERE sa.project_id=${projectId}::uuid AND sa.lecturer_id=p.id AND sa.is_active
        ))`,
  ]);
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(request: NextRequest) {
  const limited=enforceRateLimit(request,"title-review",30,60_000);if(limited)return limited;
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE" || !["ADMIN", "LECTURER"].includes(viewer.role)) {
    return NextResponse.json({ error: "Akses dosen diperlukan." }, { status: 403 });
  }
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Keputusan dan catatan dosen wajib diisi." }, { status: 400 });
  const sql = getSql();
  const rows = await sql`
    UPDATE public.title_submissions ts
    SET decision=${parsed.data.decision}, decision_reason=${parsed.data.reason}, decided_by=${viewer.id}::uuid, decided_at=now(), updated_at=now()
    FROM public.research_projects rp
    WHERE ts.id=${parsed.data.id}::uuid AND rp.id=ts.project_id AND (
      ${viewer.role === "ADMIN"} OR EXISTS (
        SELECT 1 FROM public.supervision_assignments sa WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active
      )
    ) RETURNING ts.id::text, rp.student_id::text, ts.title, ts.project_id::text
  `;
  const title = rows[0] as { id: string; student_id: string; title: string; project_id: string } | undefined;
  if (!title) return NextResponse.json({ error: "Pengajuan judul tidak ditemukan." }, { status: 404 });
  await Promise.all([
    writeAudit(sql, { actorId: viewer.id, action: `TITLE_${parsed.data.decision}`, entityType: "title_submission", entityId: title.id }),
    sql`INSERT INTO public.notifications (recipient_id,title,body,type,target_url) VALUES (
      ${title.student_id}::uuid, 'Status pengajuan judul', ${`Judul Anda dinyatakan ${parsed.data.decision === "APPROVED" ? "disetujui" : parsed.data.decision === "REVISION" ? "perlu revisi" : "ditolak"}.`}, 'TITLE_STATUS', '/dashboard')`,
    parsed.data.decision === "APPROVED"
      ? sql`UPDATE public.research_projects SET title=${title.title}, updated_at=now() WHERE id=${title.project_id}::uuid`
      : Promise.resolve([]),
  ]);
  return NextResponse.json({ ok: true, decision: parsed.data.decision });
}
