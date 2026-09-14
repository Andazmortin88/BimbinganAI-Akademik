import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE") return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Dokumen tidak valid." }, { status: 400 });

  const sql = getSql();
  const rows = await sql`
    SELECT v.original_name, v.mime_type, encode(f.content, 'base64') AS content
    FROM public.document_versions v
    JOIN public.document_files f ON f.document_version_id=v.id
    JOIN public.documents d ON d.id=v.document_id
    JOIN public.research_projects rp ON rp.id=d.project_id
    WHERE v.id=${id}::uuid AND (
      ${viewer.role === "ADMIN"}
      OR rp.student_id=${viewer.id}::uuid
      OR EXISTS (SELECT 1 FROM public.supervision_assignments sa
                 WHERE sa.project_id=rp.id AND sa.lecturer_id=${viewer.id}::uuid AND sa.is_active)
    ) LIMIT 1
  `;
  const row = rows[0] as { original_name: string; mime_type: string; content: string } | undefined;
  if (!row) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  const asciiName = row.original_name.replace(/[^a-zA-Z0-9._ -]/g, "_");
  return new NextResponse(Buffer.from(row.content, "base64"), {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.original_name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

