import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const paramsSchema=z.object({id:z.string().uuid()});
const bodySchema=z.object({status:z.enum(["ACTIVE","DISABLED"])});

export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}){
  const limited=enforceRateLimit(request,"lecturer-status",20,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.role!=="ADMIN"||viewer.status!=="ACTIVE") return NextResponse.json({error:"Hanya administrator yang dapat mengubah status dosen."},{status:403});
  const p=paramsSchema.safeParse(await context.params);const b=bodySchema.safeParse(await request.json().catch(()=>null));
  if(!p.success||!b.success) return NextResponse.json({error:"Permintaan tidak valid."},{status:400});
  const sql=getSql();
  const rows=await sql`UPDATE public.profiles SET status=${b.data.status}::public.account_status,updated_at=now() WHERE id=${p.data.id}::uuid AND role='LECTURER' RETURNING id::text,full_name,status::text`;
  const item=rows[0] as {id:string;full_name:string;status:string}|undefined;
  if(!item) return NextResponse.json({error:"Akun dosen tidak ditemukan."},{status:404});
  await writeAudit(sql,{actorId:viewer.id,action:`LECTURER_${b.data.status}`,entityType:"profile",entityId:item.id});
  return NextResponse.json({ok:true,lecturer:item});
}
