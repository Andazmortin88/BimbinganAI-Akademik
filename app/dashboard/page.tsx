import { redirect } from "next/navigation";
import Dashboard, { DashboardStudent } from "@/components/dashboard";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Viewer = {
  id: string;
  full_name: string;
  role: "ADMIN" | "LECTURER" | "STUDENT";
  status: "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED" | "COMPLETED";
};

type StudentRow = {
  id: string;
  name: string;
  nim: string;
  program: string;
  stage: string;
  progress: number | string;
  status: string;
  updated_at: Date | string;
};

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/");

  const sql = getSql();
  const profileRows = await sql`
    SELECT id::text, full_name, role::text, status::text
    FROM public.profiles
    WHERE auth_user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
  const viewer = profileRows[0] as Viewer | undefined;
  if (!viewer) redirect("/register");
  if (viewer.role === "STUDENT" && viewer.status === "PENDING") redirect("/pending");
  if (viewer.status === "REJECTED" || viewer.status === "DISABLED") redirect("/pending");

  const canSeeAll = viewer.role === "ADMIN";
  const isStudent = viewer.role === "STUDENT";
  const [studentRows, periodRows, countRows] = await Promise.all([
    sql`
      SELECT p.id::text, p.full_name AS name, sp.nim, sp.program::text,
             COALESCE(ps.name, 'Belum mulai') AS stage,
             COALESCE(ps.weight, 0)::float AS progress,
             p.status::text,
             GREATEST(p.updated_at, COALESCE(rp.updated_at, p.updated_at)) AS updated_at
      FROM public.profiles p
      JOIN public.student_profiles sp ON sp.profile_id = p.id
      LEFT JOIN public.research_projects rp ON rp.student_id = p.id AND rp.archived_at IS NULL
      LEFT JOIN public.progress_stages ps ON ps.id = rp.current_stage_id
      WHERE p.role = 'STUDENT'
        AND (
          ${canSeeAll}
          OR (${isStudent} AND p.id = ${viewer.id}::uuid)
          OR EXISTS (
            SELECT 1 FROM public.supervision_assignments sa
            WHERE sa.project_id = rp.id
              AND sa.lecturer_id = ${viewer.id}::uuid
              AND sa.is_active = true
          )
        )
      ORDER BY p.full_name
    `,
    sql`SELECT name FROM public.academic_periods WHERE is_active = true LIMIT 1`,
    sql`
      SELECT
        COUNT(DISTINCT gt.id) FILTER (WHERE gt.status IN ('SUBMITTED', 'WAITING_REVIEW', 'IN_REVIEW'))::int AS incoming_count,
        COUNT(DISTINCT d.id) FILTER (WHERE d.archived_at IS NULL)::int AS document_count
      FROM public.research_projects rp
      LEFT JOIN public.guidance_threads gt ON gt.project_id = rp.id
      LEFT JOIN public.documents d ON d.project_id = rp.id
      WHERE
        ${canSeeAll}
        OR (${isStudent} AND rp.student_id = ${viewer.id}::uuid)
        OR EXISTS (
          SELECT 1 FROM public.supervision_assignments sa
          WHERE sa.project_id = rp.id
            AND sa.lecturer_id = ${viewer.id}::uuid
            AND sa.is_active = true
        )
    `,
  ]);

  const students: DashboardStudent[] = (studentRows as StudentRow[]).map(row => ({
    id: row.id,
    name: row.name,
    nim: row.nim,
    program: row.program,
    stage: row.stage,
    progress: Number(row.progress),
    status: row.status,
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
  const counts = countRows[0] as { incoming_count?: number; document_count?: number } | undefined;
  const roleLabel = viewer.role === "ADMIN" ? "Administrator" : viewer.role === "LECTURER" ? "Dosen" : "Mahasiswa";

  return <Dashboard
    viewerName={viewer.full_name}
    viewerRole={roleLabel}
    period={(periodRows[0] as { name?: string } | undefined)?.name || "Periode belum diatur"}
    students={students}
    incomingCount={Number(counts?.incoming_count || 0)}
    documentCount={Number(counts?.document_count || 0)}
    currentTime={new Date().toISOString()}
    canManageStudents={viewer.role === "ADMIN"}
  />;
}
