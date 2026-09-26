import { NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("SAVE"),id:z.string().uuid().optional(),category:z.string().trim().min(2).max(80),title:z.string().trim().min(2).max(160),content:z.string().trim().min(2).max(5000)}),
  z.object({action:z.literal("DELETE"),id:z.string().uuid()}),
]);

export async function POST(request:Request){
  const limited=enforceRateLimit(request as never,"comment-templates",40,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.status!=="ACTIVE"||!["ADMIN","LECTURER"].includes(viewer.role)) return NextResponse.json({error:"Akses dosen diperlukan."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Data template komentar tidak valid."},{status:400});
  const sql=getSql(); const data=parsed.data;

  if(data.action==="DELETE"){
    const rows=await sql`DELETE FROM public.comment_templates WHERE id=${data.id}::uuid AND (owner_id=${viewer.id}::uuid OR ${viewer.role==="ADMIN"}) RETURNING id::text`;
    if(!rows[0]) return NextResponse.json({error:"Template komentar tidak ditemukan."},{status:404});
    await writeAudit(sql,{actorId:viewer.id,action:"COMMENT_TEMPLATE_DELETED",entityType:"comment_template",entityId:data.id});
    return NextResponse.json({ok:true});
  }

  if(data.id){
    const rows=await sql`UPDATE public.comment_templates SET category=${data.category},title=${data.title},content=${data.content},updated_at=now() WHERE id=${data.id}::uuid AND (owner_id=${viewer.id}::uuid OR ${viewer.role==="ADMIN"}) RETURNING id::text`;
    if(!rows[0]) return NextResponse.json({error:"Template komentar tidak ditemukan."},{status:404});
    await writeAudit(sql,{actorId:viewer.id,action:"COMMENT_TEMPLATE_UPDATED",entityType:"comment_template",entityId:data.id});
    return NextResponse.json({ok:true,id:data.id});
  }

  const rows=await sql`INSERT INTO public.comment_templates(owner_id,category,title,content) VALUES(${viewer.id}::uuid,${data.category},${data.title},${data.content}) RETURNING id::text`;
  const id=String(rows[0].id);
  await writeAudit(sql,{actorId:viewer.id,action:"COMMENT_TEMPLATE_CREATED",entityType:"comment_template",entityId:id});
  return NextResponse.json({ok:true,id});
}
