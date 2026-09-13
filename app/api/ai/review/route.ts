import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const requestSchema = z.object({
  documentVersionId: z.string().uuid(),
  mode: z.enum(["QUICK","LANGUAGE","BAB_I","BAB_II","BAB_III","BAB_IV","BAB_V","REFERENCES","FULL","EXAMINER","COMPARE"]),
  extractedText: z.string().min(100).max(180_000),
});

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Permintaan review tidak valid." }, { status: 400 });

  const sql = getSql();
  const versions = await sql`
    SELECT v.id, v.checksum_sha256, d.project_id
    FROM public.document_versions v
    JOIN public.documents d ON d.id = v.document_id
    JOIN public.research_projects r ON r.id = d.project_id
    JOIN public.profiles me ON me.auth_user_id = ${session.user.id}::uuid
    WHERE v.id = ${parsed.data.documentVersionId}::uuid
      AND me.status = 'ACTIVE'
      AND (
        me.role = 'ADMIN'
        OR r.student_id = me.id
        OR EXISTS (
          SELECT 1 FROM public.supervision_assignments a
          WHERE a.project_id = d.project_id AND a.lecturer_id = me.id AND a.is_active
        )
      )
    LIMIT 1
  `;
  const version = versions[0];
  if (!version) return NextResponse.json({ error: "Dokumen tidak ditemukan atau akses ditolak." }, { status: 404 });

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Layanan AI belum dikonfigurasi oleh admin." }, { status: 503 });

  const prompt = `Anda adalah asisten review akademik keperawatan. Mode: ${parsed.data.mode}. Temukan masalah secara spesifik. Jangan menyatakan plagiarisme. Kembalikan JSON array dengan field category, severity (MAJOR|MINOR|LANGUAGE), location, quotation, finding, rationale, suggestion, confidence, examiner_question, verification_source.\n\nDOKUMEN:\n${parsed.data.extractedText}`;
  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-5-mini", input: prompt, max_output_tokens: 8000 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!aiResponse.ok) return NextResponse.json({ error: "AI gagal memproses dokumen. Coba kembali nanti." }, { status: 502 });
  const result = await aiResponse.json();
  return NextResponse.json({ status: "REVIEWED_PRIVATE", raw: result, warning: "Hasil AI wajib diperiksa dosen dan tidak otomatis dikirim kepada mahasiswa." });
}
