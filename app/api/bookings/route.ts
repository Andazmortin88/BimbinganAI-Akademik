import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

const bodySchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("CREATE_SLOT"),startsAt:z.string().datetime(),endsAt:z.string().datetime(),method:z.enum(["Tatap muka","Google Meet/Zoom","WhatsApp"]),locationOrUrl:z.string().trim().max(500).optional(),quota:z.number().int().min(1).max(20)}),
  z.object({action:z.literal("BOOK"),slotId:z.string().uuid(),topic:z.string().trim().min(3).max(300),note:z.string().trim().max(2000).optional()}),
  z.object({action:z.literal("DECIDE"),bookingId:z.string().uuid(),status:z.enum(["CONFIRMED","REJECTED","COMPLETED","CANCELLED"])}),
]);

export async function POST(request:NextRequest){
  const limited=enforceRateLimit(request,"bookings",30,60_000);if(limited)return limited;
  const viewer=await getViewer();
  if(!viewer||viewer.status!=="ACTIVE") return NextResponse.json({error:"Sesi aktif diperlukan."},{status:403});
  const parsed=bodySchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Data jadwal belum lengkap atau tidak valid."},{status:400});
  const sql=getSql(); const data=parsed.data;
  if(data.action==="CREATE_SLOT"){
    if(!["ADMIN","LECTURER"].includes(viewer.role)) return NextResponse.json({error:"Hanya dosen yang dapat membuka slot bimbingan."},{status:403});
    if(new Date(data.endsAt)<=new Date(data.startsAt)) return NextResponse.json({error:"Waktu selesai harus setelah waktu mulai."},{status:400});
    const overlap=await sql`SELECT 1 FROM public.booking_slots WHERE lecturer_id=${viewer.id}::uuid AND is_active AND starts_at<${data.endsAt}::timestamptz AND ends_at>${data.startsAt}::timestamptz LIMIT 1`;
    if(overlap[0]) return NextResponse.json({error:"Waktu tersebut bertabrakan dengan slot lain."},{status:409});
    const rows=await sql`INSERT INTO public.booking_slots(lecturer_id,starts_at,ends_at,method,location_or_url,quota) VALUES(${viewer.id}::uuid,${data.startsAt}::timestamptz,${data.endsAt}::timestamptz,${data.method},${data.locationOrUrl||null},${data.quota}) RETURNING id::text`;
    const id=String(rows[0].id); await writeAudit(sql,{actorId:viewer.id,action:"BOOKING_SLOT_CREATED",entityType:"booking_slot",entityId:id});
    return NextResponse.json({ok:true,id});
  }
  if(data.action==="BOOK"){
    if(viewer.role!=="STUDENT") return NextResponse.json({error:"Hanya mahasiswa yang dapat memesan slot."},{status:403});
    const projects=await sql`SELECT id::text FROM public.research_projects WHERE student_id=${viewer.id}::uuid AND archived_at IS NULL LIMIT 1`;
    const projectId=(projects[0] as {id?:string}|undefined)?.id;
    if(!projectId) return NextResponse.json({error:"Proyek skripsi belum tersedia."},{status:409});
    const slots=await sql`SELECT s.id::text,s.lecturer_id::text,s.quota,count(br.id)::int AS booked FROM public.booking_slots s LEFT JOIN public.booking_requests br ON br.slot_id=s.id AND br.status IN('PENDING','CONFIRMED') WHERE s.id=${data.slotId}::uuid AND s.is_active AND s.starts_at>now() GROUP BY s.id`;
    const slot=slots[0] as {id:string;lecturer_id:string;quota:number;booked:number}|undefined;
    if(!slot||slot.booked>=slot.quota) return NextResponse.json({error:"Slot sudah penuh atau tidak lagi tersedia."},{status:409});
    const rows=await sql`INSERT INTO public.booking_requests(slot_id,project_id,topic,note,status,decided_by,decided_at) VALUES(${slot.id}::uuid,${projectId}::uuid,${data.topic},${data.note||null},'CONFIRMED',${slot.lecturer_id}::uuid,now()) RETURNING id::text`;
    const id=String(rows[0].id);
    await Promise.all([
      writeAudit(sql,{actorId:viewer.id,action:"BOOKING_CREATED",entityType:"booking_request",entityId:id}),
      sql`INSERT INTO public.notifications(recipient_id,title,body,type,target_url) VALUES(${slot.lecturer_id}::uuid,'Booking bimbingan baru',${`${viewer.fullName}: ${data.topic}`},'BOOKING_CONFIRMED','/dashboard')`,
    ]);
    return NextResponse.json({ok:true,id});
  }
  if(!["ADMIN","LECTURER"].includes(viewer.role)) return NextResponse.json({error:"Akses dosen diperlukan."},{status:403});
  const rows=await sql`UPDATE public.booking_requests br SET status=${data.status},decided_by=${viewer.id}::uuid,decided_at=now(),updated_at=now() FROM public.booking_slots s,public.research_projects rp WHERE br.id=${data.bookingId}::uuid AND s.id=br.slot_id AND rp.id=br.project_id AND (${viewer.role==="ADMIN"} OR s.lecturer_id=${viewer.id}::uuid) RETURNING br.id::text,rp.student_id::text`;
  const booking=rows[0] as {id:string;student_id:string}|undefined;
  if(!booking) return NextResponse.json({error:"Booking tidak ditemukan."},{status:404});
  await Promise.all([
    writeAudit(sql,{actorId:viewer.id,action:`BOOKING_${data.status}`,entityType:"booking_request",entityId:booking.id}),
    sql`INSERT INTO public.notifications(recipient_id,title,body,type,target_url) VALUES(${booking.student_id}::uuid,'Status booking diperbarui',${`Booking bimbingan: ${data.status}.`},'BOOKING_STATUS','/dashboard')`,
  ]);
  return NextResponse.json({ok:true});
}
