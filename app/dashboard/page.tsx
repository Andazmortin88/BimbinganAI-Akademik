import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import StudentDashboard from "@/components/student-dashboard";
import type { DashboardAppointment, DashboardConsultation, DashboardDocument, DashboardMessage, DashboardReview, DashboardStudent } from "@/components/dashboard-types";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/");
  if (viewer.role === "STUDENT" && viewer.status === "PENDING") redirect("/pending");
  if (viewer.status === "REJECTED" || viewer.status === "DISABLED") redirect("/pending");

  const sql = getSql();
  const canSeeAll = viewer.role === "ADMIN";
  const isStudent = viewer.role === "STUDENT";
  const [studentRows, periodRows, documentRows, consultationRows, appointmentRows, reviewRows] = await Promise.all([
    sql`
      SELECT p.id::text, p.full_name AS name, sp.nim, sp.program::text,
             COALESCE(ps.name, 'Belum mulai') AS stage, COALESCE(ps.weight, 0)::float AS progress,
             p.status::text, GREATEST(p.updated_at, COALESCE(rp.updated_at,p.updated_at)) AS updated_at
      FROM public.profiles p JOIN public.student_profiles sp ON sp.profile_id=p.id
      LEFT JOIN public.research_projects rp ON rp.student_id=p.id AND rp.archived_at IS NULL
      LEFT JOIN public.progress_stages ps ON ps.id=rp.current_stage_id
      WHERE p.role='STUDENT' AND (
        ${canSeeAll} OR (${isStudent} AND p.id=${viewer.id}::uuid)
        OR EXISTS (SELECT 1 FROM public.supervision_assignments sa WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)
      ) ORDER BY p.full_name`,
    sql`SELECT name FROM public.academic_periods WHERE is_active=true LIMIT 1`,
    sql`
      SELECT v.id::text, p.full_name AS student_name, d.category, v.original_name AS name,
             v.version_no, v.status::text, v.size_bytes::float, v.created_at,
             (f.extracted_text IS NOT NULL AND length(f.extracted_text)>=100) AS can_ai_review
      FROM public.document_versions v JOIN public.documents d ON d.id=v.document_id
      JOIN public.research_projects rp ON rp.id=d.project_id JOIN public.profiles p ON p.id=rp.student_id
      LEFT JOIN public.document_files f ON f.document_version_id=v.id
      WHERE ${canSeeAll}
         OR (${isStudent} AND rp.student_id=${viewer.id}::uuid)
         OR EXISTS (SELECT 1 FROM public.supervision_assignments sa
                    WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)
      ORDER BY v.created_at DESC`,
    sql`
      SELECT gt.id::text, p.full_name AS student_name, gt.subject, gt.status::text, gt.updated_at,
        COALESCE(jsonb_agg(jsonb_build_object(
          'id',m.id::text,'senderName',sender.full_name,'senderRole',sender.role::text,
          'body',m.body,'createdAt',m.created_at
        ) ORDER BY m.created_at) FILTER (WHERE m.id IS NOT NULL), '[]'::jsonb) AS messages
      FROM public.guidance_threads gt JOIN public.research_projects rp ON rp.id=gt.project_id
      JOIN public.profiles p ON p.id=rp.student_id
      LEFT JOIN public.messages m ON m.thread_id=gt.id AND m.deleted_at IS NULL
      LEFT JOIN public.profiles sender ON sender.id=m.sender_id
      WHERE ${canSeeAll}
         OR (${isStudent} AND rp.student_id=${viewer.id}::uuid)
         OR EXISTS (SELECT 1 FROM public.supervision_assignments sa
                    WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)
      GROUP BY gt.id,p.full_name ORDER BY gt.updated_at DESC`,
    sql`
      SELECT a.id::text, a.topic, p.full_name AS student_name, a.starts_at, a.method,
             a.decision::text, a.meeting_url
      FROM public.appointments a JOIN public.research_projects rp ON rp.id=a.project_id
      JOIN public.profiles p ON p.id=rp.student_id
      WHERE ${canSeeAll}
         OR (${isStudent} AND rp.student_id=${viewer.id}::uuid)
         OR EXISTS (SELECT 1 FROM public.supervision_assignments sa
                    WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)
      ORDER BY a.starts_at`,
    viewer.role === "ADMIN" ? sql`
      SELECT ar.id::text, v.original_name AS document_name, p.full_name AS student_name,
             ar.review_mode AS mode, ar.status, count(ari.id)::int AS item_count, ar.created_at
      FROM public.ai_reviews ar JOIN public.document_versions v ON v.id=ar.document_version_id
      JOIN public.documents d ON d.id=v.document_id JOIN public.research_projects rp ON rp.id=d.project_id
      JOIN public.profiles p ON p.id=rp.student_id LEFT JOIN public.ai_review_items ari ON ari.ai_review_id=ar.id
      GROUP BY ar.id,v.original_name,p.full_name ORDER BY ar.created_at DESC LIMIT 50` : Promise.resolve([]),
  ]);

  const students: DashboardStudent[] = studentRows.map(row => ({
    id:String(row.id), name:String(row.name), nim:String(row.nim), program:String(row.program), stage:String(row.stage),
    progress:Number(row.progress), status:String(row.status), updatedAt:new Date(row.updated_at as string).toISOString(),
  }));
  const documents: DashboardDocument[] = documentRows.map(row => ({
    id:String(row.id), studentName:String(row.student_name), category:String(row.category), name:String(row.name),
    version:Number(row.version_no), status:String(row.status), sizeBytes:Number(row.size_bytes),
    createdAt:new Date(row.created_at as string).toISOString(), canAiReview:Boolean(row.can_ai_review),
  }));
  const consultations: DashboardConsultation[] = consultationRows.map(row => ({
    id:String(row.id), studentName:String(row.student_name), subject:String(row.subject), status:String(row.status),
    updatedAt:new Date(row.updated_at as string).toISOString(),
    messages:(row.messages as DashboardMessage[]).map(message => ({...message, createdAt:new Date(message.createdAt).toISOString()})),
  }));
  const appointments: DashboardAppointment[] = appointmentRows.map(row => ({
    id:String(row.id), topic:String(row.topic), studentName:String(row.student_name), startsAt:new Date(row.starts_at as string).toISOString(),
    method:String(row.method), decision:String(row.decision), meetingUrl:row.meeting_url ? String(row.meeting_url) : null,
  }));
  const reviews: DashboardReview[] = reviewRows.map(row => ({
    id:String(row.id), documentName:String(row.document_name), studentName:String(row.student_name), mode:String(row.mode),
    status:String(row.status), itemCount:Number(row.item_count), createdAt:new Date(row.created_at as string).toISOString(),
  }));
  const period = String((periodRows[0] as {name?:string}|undefined)?.name || "Periode belum diatur");

  if (viewer.role === "STUDENT") {
    const student = students[0];
    if (!student) redirect("/register");
    return <StudentDashboard viewerName={viewer.fullName} period={period} student={student} consultations={consultations} documents={documents} appointments={appointments}/>;
  }
  return <Dashboard viewerName={viewer.fullName} viewerRole={viewer.role} period={period} students={students} consultations={consultations} documents={documents} appointments={appointments} reviews={reviews} currentTime={new Date().toISOString()}/>;
}
