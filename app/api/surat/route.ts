import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("REQUEST"),templateId:z.string().uuid(),purpose:z.string().trim().min(5).max(2000)}),
  z.object({action:z.literal("DECIDE"),id:z.string().uuid(),status:z.enum(["APPROVED","REJECTED","COMPLETED"]),notes:z.string().trim().max(2000).optional()}),
  z.object({action:z.literal("CREATE_TEMPLATE"),name:z.string().trim().min(3).max(160),documentType:z.string().trim().min(2).max(80),bodyTemplate:z.string().trim().min(10).max(20000)}),
  z.object({action:z.literal("TOGGLE_TEMPLATE"),id:z.string().uuid(),isActive:z.boolean()}),
]);

export async function POST(request:NextRequest){
  const limited=enforceRateLimit(request,"surat-admin",30,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.status!=="ACTIVE") return NextResponse.json({error:"Sesi aktif diperlukan."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Permintaan surat tidak valid."},{status:400});
  const sql=getSql(); const data=parsed.data;

  if(data.action==="REQUEST"){
    if(viewer.role!=="STUDENT") return NextResponse.json({error:"Pengajuan surat hanya untuk mahasiswa."},{status:403});
    const projects=await sql`SELECT id::text FROM public.research_projects WHERE student_id=${viewer.id}::uuid AND archived_at IS NULL LIMIT 1`;
    const projectId=(projects[0] as {id?:string}|undefined)?.id;
    if(!projectId) return NextResponse.json({error:"Proyek akademik belum tersedia."},{status:409});
    const template=await sql`SELECT id::text,name FROM public.surat_templates WHERE id=${data.templateId}::uuid AND is_active LIMIT 1`;
    if(!template[0]) return NextResponse.json({error:"Template surat tidak tersedia."},{status:404});
    const rows=await sql`INSERT INTO public.surat_requests(project_id,template_id,purpose,requested_by) VALUES(${projectId}::uuid,${data.templateId}::uuid,${data.purpose},${viewer.id}::uuid) RETURNING id::text`;
    const id=String(rows[0].id);
    await Promise.all([
      writeAudit(sql,{actorId:viewer.id,action:"SURAT_REQUESTED",entityType:"surat_request",entityId:id}),
      sql`INSERT INTO public.notifications(recipient_id,title,body,type,target_url)
          SELECT p.id,'Pengajuan surat baru',${`${viewer.fullName} mengajukan ${String((template[0] as {name:string}).name)}.`},'SURAT_REQUEST','/dashboard'
          FROM public.profiles p WHERE p.role='ADMIN' AND p.status='ACTIVE'`,
    ]);
    return NextResponse.json({ok:true,id});
  }

  if(data.action==="CREATE_TEMPLATE"){
    if(viewer.role!=="ADMIN") return NextResponse.json({error:"Hanya administrator yang dapat membuat template surat."},{status:403});
    const rows=await sql`INSERT INTO public.surat_templates(name,document_type,body_template,created_by) VALUES(${data.name},${data.documentType},${data.bodyTemplate},${viewer.id}::uuid)
      ON CONFLICT(name) DO UPDATE SET document_type=EXCLUDED.document_type,body_template=EXCLUDED.body_template,is_active=true,updated_at=now()
      RETURNING id::text`;
    const id=String(rows[0].id);
    await writeAudit(sql,{actorId:viewer.id,action:"SURAT_TEMPLATE_SAVED",entityType:"surat_template",entityId:id});
    return NextResponse.json({ok:true,id});
  }

  if(data.action==="TOGGLE_TEMPLATE"){
    if(viewer.role!=="ADMIN") return NextResponse.json({error:"Hanya administrator yang dapat mengatur template surat."},{status:403});
    const rows=await sql`UPDATE public.surat_templates SET is_active=${data.isActive},updated_at=now() WHERE id=${data.id}::uuid RETURNING id::text`;
    if(!rows[0]) return NextResponse.json({error:"Template surat tidak ditemukan."},{status:404});
    await writeAudit(sql,{actorId:viewer.id,action:data.isActive?"SURAT_TEMPLATE_ACTIVATED":"SURAT_TEMPLATE_DISABLED",entityType:"surat_template",entityId:data.id});
    return NextResponse.json({ok:true});
  }

  if(!["ADMIN","LECTURER"].includes(viewer.role)) return NextResponse.json({error:"Akses dosen diperlukan."},{status:403});
  const rows=await sql`
    UPDATE public.surat_requests sr
    SET status=${data.status},reviewer_notes=${data.notes||null},reviewed_by=${viewer.id}::uuid,reviewed_at=now(),updated_at=now()
    FROM public.research_projects rp
    WHERE sr.id=${data.id}::uuid AND rp.id=sr.project_id
      AND (${viewer.role==="ADMIN"} OR EXISTS(
        SELECT 1 FROM public.supervision_assignments sa
        WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active
      ))
    RETURNING sr.id::text,rp.student_id::text
  `;
  const item=rows[0] as {id:string;student_id:string}|undefined;
  if(!item) return NextResponse.json({error:"Pengajuan surat tidak ditemukan atau di luar akses Anda."},{status:404});
  await Promise.all([
    writeAudit(sql,{actorId:viewer.id,action:`SURAT_${data.status}`,entityType:"surat_request",entityId:item.id}),
    sql`INSERT INTO public.notifications(recipient_id,title,body,type,target_url)
       VALUES(${item.student_id}::uuid,'Status pengajuan surat',${`Pengajuan surat Anda: ${data.status}.`},'SURAT_STATUS','/dashboard')`,
  ]);
  return NextResponse.json({ok:true});
}
