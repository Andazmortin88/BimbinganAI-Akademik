import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const schema=z.object({
  fullName:z.string().trim().min(2).max(150),
  phone:z.string().trim().max(30).optional().default(""),
  bio:z.string().trim().max(2000).optional().default(""),
  googleScholarUrl:z.union([z.string().trim().url().max(500),z.literal("")]).optional().default(""),
  orcidId:z.union([z.string().trim().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i),z.literal("")]).optional().default(""),
});

export async function POST(request:NextRequest){
  const limited=enforceRateLimit(request,"profile-update",20,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.status!=="ACTIVE"||!["ADMIN","LECTURER"].includes(viewer.role)) return NextResponse.json({error:"Akses dosen diperlukan."},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Profil belum lengkap atau format ORCID/URL tidak valid."},{status:400});
  const d=parsed.data; const sql=getSql();
  await sql`UPDATE public.profiles SET full_name=${d.fullName},phone=${d.phone||null},bio=${d.bio||null},google_scholar_url=${d.googleScholarUrl||null},orcid_id=${d.orcidId||null},updated_at=now() WHERE id=${viewer.id}::uuid`;
  await writeAudit(sql,{actorId:viewer.id,action:"PROFILE_UPDATED",entityType:"profile",entityId:viewer.id});
  return NextResponse.json({ok:true});
}
