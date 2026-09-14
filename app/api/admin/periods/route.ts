import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("CREATE"),name:z.string().trim().min(5).max(100),semester:z.union([z.literal(1),z.literal(2)]),academicYear:z.string().regex(/^\d{4}\/\d{4}$/),startsOn:z.string().date(),endsOn:z.string().date()}),
  z.object({action:z.literal("ACTIVATE"),id:z.string().uuid()}),
  z.object({action:z.literal("LOCK"),id:z.string().uuid(),locked:z.boolean()}),
]);

export async function POST(request:NextRequest){
  const limited=enforceRateLimit(request,"periods",20,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.role!=="ADMIN"||viewer.status!=="ACTIVE") return NextResponse.json({error:"Hanya administrator yang dapat mengatur periode."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Data periode akademik tidak valid."},{status:400});
  const sql=getSql(); const data=parsed.data;
  if(data.action==="CREATE"){
    if(new Date(data.endsOn)<=new Date(data.startsOn)) return NextResponse.json({error:"Tanggal selesai harus setelah tanggal mulai."},{status:400});
    const rows=await sql`INSERT INTO public.academic_periods(name,semester,academic_year,starts_on,ends_on) VALUES(${data.name},${data.semester},${data.academicYear},${data.startsOn}::date,${data.endsOn}::date) RETURNING id::text`;
    const id=String(rows[0].id); await writeAudit(sql,{actorId:viewer.id,action:"PERIOD_CREATED",entityType:"academic_period",entityId:id}); return NextResponse.json({ok:true,id});
  }
  if(data.action==="ACTIVATE"){
    await sql.transaction(tx=>[tx`UPDATE public.academic_periods SET is_active=false,updated_at=now() WHERE is_active`,tx`UPDATE public.academic_periods SET is_active=true,updated_at=now() WHERE id=${data.id}::uuid`]);
    await writeAudit(sql,{actorId:viewer.id,action:"PERIOD_ACTIVATED",entityType:"academic_period",entityId:data.id}); return NextResponse.json({ok:true});
  }
  await sql`UPDATE public.academic_periods SET is_locked=${data.locked},updated_at=now() WHERE id=${data.id}::uuid`;
  await writeAudit(sql,{actorId:viewer.id,action:data.locked?"PERIOD_LOCKED":"PERIOD_UNLOCKED",entityType:"academic_period",entityId:data.id}); return NextResponse.json({ok:true});
}
