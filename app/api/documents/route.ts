import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";
const CATEGORIES = new Set(["PROPOSAL", "BAB I", "BAB II", "BAB III", "BAB IV", "BAB V", "NASKAH LENGKAP"]);

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  if (viewer.role !== "STUDENT" || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hanya mahasiswa aktif yang dapat mengunggah dokumen." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const category = String(form?.get("category") || "NASKAH LENGKAP").toUpperCase();
  if (!(file instanceof File) || !CATEGORIES.has(category)) {
    return NextResponse.json({ error: "Berkas atau kategori dokumen tidak valid." }, { status: 400 });
  }
  const extension = file.name.toLowerCase().split(".").pop();
  if (!(["doc", "docx"].includes(extension || "")) || ![DOC_MIME, DOCX_MIME, "application/octet-stream"].includes(file.type || "application/octet-stream")) {
    return NextResponse.json({ error: "Gunakan berkas Microsoft Word .doc atau .docx." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Ukuran berkas harus antara 1 byte dan 4 MB." }, { status: 413 });
  }

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

  const sql = getSql();
  const projects = await sql`
    SELECT id::text FROM public.research_projects
    WHERE student_id = ${viewer.id}::uuid AND archived_at IS NULL LIMIT 1
  `;
  const projectId = (projects[0] as { id?: string } | undefined)?.id;
  if (!projectId) return NextResponse.json({ error: "Proyek skripsi belum tersedia." }, { status: 409 });

  const versionId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180);
  const base64 = bytes.toString("base64");

  try {
    await sql.transaction((tx) => [
      tx`INSERT INTO public.documents (project_id, category, created_by)
         VALUES (${projectId}::uuid, ${category}, ${viewer.id}::uuid)
         ON CONFLICT (project_id, category) DO UPDATE SET updated_at = now()`,
      tx`INSERT INTO public.document_versions
           (id, document_id, version_no, original_name, archive_name, storage_path, mime_type,
            size_bytes, checksum_sha256, stage_id, previous_version_id, status, uploaded_by, extracted_text_path)
         SELECT ${versionId}::uuid, d.id, d.latest_version + 1, ${safeName},
                ${`${viewer.id}_${Date.now()}_${safeName}`}, ${`db://document-files/${versionId}`},
                ${extension === "docx" ? DOCX_MIME : DOC_MIME}, ${file.size}, ${checksum},
                rp.current_stage_id,
                (SELECT v.id FROM public.document_versions v WHERE v.document_id=d.id ORDER BY v.version_no DESC LIMIT 1),
                'SUBMITTED', ${viewer.id}::uuid, ${extractedText ? `db://document-files/${versionId}/text` : null}
         FROM public.documents d JOIN public.research_projects rp ON rp.id=d.project_id
         WHERE d.project_id=${projectId}::uuid AND d.category=${category}`,
      tx`INSERT INTO public.document_files (document_version_id, content, extracted_text)
         VALUES (${versionId}::uuid, decode(${base64}, 'base64'), ${extractedText})`,
      tx`UPDATE public.documents d
         SET latest_version = v.version_no, updated_at = now()
         FROM public.document_versions v
         WHERE v.id=${versionId}::uuid AND d.id=v.document_id`,
      tx`INSERT INTO public.notifications (recipient_id, title, body, type, target_url)
         SELECT p.id, 'Dokumen baru diunggah', ${`${viewer.fullName} mengunggah ${category}.`}, 'DOCUMENT', '/dashboard'
         FROM public.profiles p WHERE p.role='ADMIN' AND p.status='ACTIVE'`,
    ]);
  } catch (error) {
    console.error("document_upload_failed", error);
    return NextResponse.json({ error: "Dokumen belum dapat disimpan. Silakan coba kembali." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, versionId, extracted: Boolean(extractedText) });
}

