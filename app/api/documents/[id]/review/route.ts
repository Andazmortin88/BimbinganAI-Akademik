import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { writeAudit } from "@/lib/audit";
import { getSql } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const UUID_RE = /^[0-9a-f-]{36}$/i;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const limited = enforceRateLimit(request, "document-review-upload", 20, 60_000);
  if (limited) return limited;

  const viewer = await getViewer();
  if (!viewer || viewer.status !== "ACTIVE" || !["ADMIN", "LECTURER"].includes(viewer.role)) {
    return NextResponse.json({ error: "Akses dosen atau administrator diperlukan." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Dokumen tidak valid." }, { status: 400 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const note = String(form?.get("note") || "").trim().slice(0, 2000);
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Pilih berkas hasil review terlebih dahulu." }, { status: 400 });
  }

  const extension = file.name.toLowerCase().split(".").pop();
  if (!["doc", "docx"].includes(extension || "") ||
      ![DOC_MIME, DOCX_MIME, "application/octet-stream"].includes(file.type || "application/octet-stream")) {
    return NextResponse.json({ error: "Hasil review harus berupa berkas Microsoft Word .doc atau .docx." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Ukuran berkas hasil review harus antara 1 byte dan 4 MB." }, { status: 413 });
  }

  const sql = getSql();
  const rows = await sql`
    SELECT d.id::text AS document_id, d.category, d.latest_version,
           rp.id::text AS project_id, rp.student_id::text, rp.current_stage_id,
           p.full_name AS student_name
    FROM public.document_versions source
    JOIN public.documents d ON d.id=source.document_id
    JOIN public.research_projects rp ON rp.id=d.project_id
    JOIN public.profiles p ON p.id=rp.student_id
    WHERE source.id=${id}::uuid
      AND (
        ${viewer.role === "ADMIN"}
        OR EXISTS (
          SELECT 1 FROM public.supervision_assignments sa
          WHERE sa.project_id=rp.id
            AND sa.lecturer_id=${viewer.id}::uuid
            AND sa.is_active
        )
      )
    LIMIT 1
  `;
  const target = rows[0] as {
    document_id: string;
    category: string;
    latest_version: number;
    project_id: string;
    student_id: string;
    current_stage_id: number | null;
    student_name: string;
  } | undefined;
  if (!target) return NextResponse.json({ error: "Dokumen tidak ditemukan atau bukan mahasiswa bimbingan Anda." }, { status: 404 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  let extractedText: string | null = null;
  if (extension === "docx") {
    try {
      const result = await mammoth.extractRawText({ buffer: bytes });
      extractedText = result.value.trim().slice(0, 180_000) || null;
    } catch {
      extractedText = null;
    }
  }

  const versionId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
  const base64 = bytes.toString("base64");
  const notificationBody = note
    ? `${viewer.fullName} mengirim hasil review ${target.category}: ${safeName}. Catatan: ${note}`
    : `${viewer.fullName} mengirim hasil review ${target.category}: ${safeName}.`;

  try {
    await sql.transaction((tx) => [
      tx`INSERT INTO public.document_versions
           (id, document_id, version_no, original_name, archive_name, storage_path, mime_type,
            size_bytes, checksum_sha256, stage_id, previous_version_id, status, uploaded_by, extracted_text_path)
         SELECT ${versionId}::uuid, d.id, d.latest_version + 1, ${safeName},
                ${`review_${viewer.id}_${Date.now()}_${safeName}`}, ${`db://document-files/${versionId}`},
                ${extension === "docx" ? DOCX_MIME : DOC_MIME}, ${file.size}, ${checksum},
                rp.current_stage_id,
                (SELECT v.id FROM public.document_versions v WHERE v.document_id=d.id ORDER BY v.version_no DESC LIMIT 1),
                'SUBMITTED', ${viewer.id}::uuid, ${extractedText ? `db://document-files/${versionId}/text` : null}
         FROM public.documents d
         JOIN public.research_projects rp ON rp.id=d.project_id
         WHERE d.id=${target.document_id}::uuid`,
      tx`INSERT INTO public.document_files (document_version_id, content, extracted_text)
         VALUES (${versionId}::uuid, decode(${base64}, 'base64'), ${extractedText})`,
      tx`UPDATE public.documents d
         SET latest_version=v.version_no, updated_at=now()
         FROM public.document_versions v
         WHERE v.id=${versionId}::uuid AND d.id=v.document_id`,
      tx`INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
         VALUES (${target.student_id}::uuid, 'Hasil review dosen tersedia',
                 ${notificationBody}, 'DOCUMENT_REVIEW', '/dashboard')`,
    ]);
    await writeAudit(sql, {
      actorId: viewer.id,
      action: "DOCUMENT_REVIEW_FILE_SENT",
      entityType: "document_version",
      entityId: versionId,
    });
  } catch (error) {
    console.error("document_review_upload_failed", error);
    return NextResponse.json({ error: "File hasil review belum dapat dikirim. Silakan coba kembali." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    versionId,
    studentName: target.student_name,
    version: Number(target.latest_version) + 1,
  });
}
