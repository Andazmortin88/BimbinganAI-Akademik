import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const createSchema = z.object({
  entryDate: z.string().date(),
  topic: z.string().trim().min(3).max(200),
  summary: z.string().trim().min(10).max(5000),
  feedbackReceived: z.string().trim().max(5000).optional(),
  actionItems: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  nextMeetingTarget: z.string().date().optional().or(z.literal("")),
  meetingType: z.enum(["CHAT", "IN_PERSON", "DOCUMENT_REVISION"]),
  guidanceThreadId: z.string().uuid().optional(),
});
const verifySchema = z.object({ id: z.string().uuid(), verified: z.boolean() });

export async function POST(request: NextRequest) {
  const limited=enforceRateLimit(request,"logbook",20,60_000);if(limited)return limited;
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "STUDENT" || viewer.status !== "ACTIVE") return NextResponse.json({ error: "Akses mahasiswa aktif diperlukan." }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tanggal, topik, dan ringkasan catatan wajib diisi." }, { status: 400 });
  const sql = getSql();
  const projects = await sql`SELECT id::text FROM public.research_projects WHERE student_id=${viewer.id}::uuid AND archived_at IS NULL LIMIT 1`;
  const projectId = (projects[0] as { id?: string } | undefined)?.id;
  if (!projectId) return NextResponse.json({ error: "Proyek skripsi belum tersedia." }, { status: 409 });
  const data = parsed.data;
  const rows = await sql`
    INSERT INTO public.logbook_entries
      (project_id,guidance_thread_id,entry_date,topic,summary,feedback_received,action_items,next_meeting_target,meeting_type,created_by)
    VALUES (${projectId}::uuid,${data.guidanceThreadId || null}::uuid,${data.entryDate}::date,${data.topic},${data.summary},${data.feedbackReceived || null},${JSON.stringify(data.actionItems)}::jsonb,${data.nextMeetingTarget || null}::date,${data.meetingType},${viewer.id}::uuid)
    RETURNING id::text
  `;
  const id=String(rows[0].id);
  await writeAudit(sql,{actorId:viewer.id,action:"LOGBOOK_CREATED",entityType:"logbook_entry",entityId:id});
  return NextResponse.json({ok:true,id});
}

export async function PATCH(request: NextRequest) {
  const limited=enforceRateLimit(request,"logbook-review",40,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.status!=="ACTIVE"||!["ADMIN","LECTURER"].includes(viewer.role)) return NextResponse.json({error:"Akses dosen diperlukan."},{status:403});
  const parsed=verifySchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Permintaan verifikasi tidak valid."},{status:400});
  const sql=getSql();
  const rows=await sql`UPDATE public.logbook_entries l SET is_verified=${parsed.data.verified},verified_by=${parsed.data.verified?viewer.id:null}::uuid,verified_at=${parsed.data.verified?new Date().toISOString():null}::timestamptz,updated_at=now()
    FROM public.research_projects rp WHERE l.id=${parsed.data.id}::uuid AND rp.id=l.project_id AND (${viewer.role==="ADMIN"} OR EXISTS(SELECT 1 FROM public.supervision_assignments sa WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)) RETURNING l.id::text`;
  if(!rows[0]) return NextResponse.json({error:"Catatan bimbingan tidak ditemukan."},{status:404});
  await writeAudit(sql,{actorId:viewer.id,action:parsed.data.verified?"LOGBOOK_VERIFIED":"LOGBOOK_UNVERIFIED",entityType:"logbook_entry",entityId:parsed.data.id});
  return NextResponse.json({ok:true});
}
