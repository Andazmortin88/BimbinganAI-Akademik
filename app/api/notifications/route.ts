import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const schema=z.object({id:z.string().uuid().optional(),all:z.boolean().optional()}).refine(value=>Boolean(value.id||value.all));

export async function PATCH(request:NextRequest){
  const limited=enforceRateLimit(request,"notifications",60,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer) return NextResponse.json({error:"Sesi tidak valid."},{status:401});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Notifikasi tidak valid."},{status:400});
  const sql=getSql();
  if(parsed.data.all) await sql`UPDATE public.notifications SET read_at=COALESCE(read_at,now()),updated_at=now() WHERE recipient_id=${viewer.id}::uuid`;
  else await sql`UPDATE public.notifications SET read_at=COALESCE(read_at,now()),updated_at=now() WHERE id=${parsed.data.id}::uuid AND recipient_id=${viewer.id}::uuid`;
  return NextResponse.json({ok:true});
}
