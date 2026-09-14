import { NextResponse } from "next/server";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  documentVersionId: z.string().uuid(),
  mode: z.enum(["QUICK", "LANGUAGE", "BAB_I", "BAB_II", "BAB_III", "BAB_IV", "BAB_V", "REFERENCES", "FULL", "EXAMINER"]),
});

const itemSchema = z.object({
  category: z.string().min(1).max(100),
  severity: z.enum(["MAJOR", "MINOR", "LANGUAGE"]),
  location: z.string().max(250).nullable().optional(),
  quotation: z.string().max(1500).nullable().optional(),
  finding: z.string().min(1).max(3000),
  rationale: z.string().min(1).max(3000),
  suggestion: z.string().min(1).max(3000),
  confidence: z.number().min(0).max(1).nullable().optional(),
  examiner_question: z.string().max(1000).nullable().optional(),
  verification_source: z.string().max(1000).nullable().optional(),
});

function extractOutputText(result: unknown) {
  if (!result || typeof result !== "object") return "";
  const response = result as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  return (response.output || []).flatMap(item => item.content || []).filter(item => item.type === "output_text").map(item => item.text || "").join("");
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sesi tidak valid." }, { status: 401 });
  if (viewer.role !== "ADMIN" || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "AI Review hanya dapat dijalankan oleh administrator." }, { status: 403 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Permintaan review tidak valid." }, { status: 400 });

  const sql = getSql();
  const versions = await sql`
    SELECT v.id::text, v.checksum_sha256, v.original_name, f.extracted_text
    FROM public.document_versions v
    JOIN public.document_files f ON f.document_version_id=v.id
    WHERE v.id=${parsed.data.documentVersionId}::uuid
    LIMIT 1
  `;
  const version = versions[0] as { id: string; checksum_sha256: string; original_name: string; extracted_text: string | null } | undefined;
  if (!version) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });
  if (!version.extracted_text || version.extracted_text.length < 100) {
    return NextResponse.json({ error: "Teks dokumen belum dapat dibaca. Gunakan berkas .docx yang berisi teks." }, { status: 422 });
  }

  const settingRows = await sql`
    SELECT enabled, model_name, custom_instructions, max_findings
    FROM public.ai_review_settings WHERE id=1 LIMIT 1
  `;
  const settings = settingRows[0] as {
    enabled: boolean; model_name: string; custom_instructions: string; max_findings: number;
  } | undefined;
  if (settings && !settings.enabled) {
    return NextResponse.json({ error: "AI Review sedang dinonaktifkan pada pengaturan admin." }, { status: 503 });
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const gatewayAvailable = Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL);
  if (!apiKey && !gatewayAvailable) {
    return NextResponse.json({ error: "Layanan AI belum dikonfigurasi oleh admin." }, { status: 503 });
  }
  const model = settings?.model_name || "gpt-5-mini";
  const maxFindings = Number(settings?.max_findings || 20);
  const reviewRows = await sql`
    INSERT INTO public.ai_reviews
      (document_version_id, review_mode, document_hash, model_name, rubric_version, status, requested_by)
    VALUES (${version.id}::uuid, ${parsed.data.mode}, ${version.checksum_sha256}, ${model}, 1, 'PROCESSING', ${viewer.id}::uuid)
    ON CONFLICT (document_hash, review_mode, rubric_version, model_name)
    DO UPDATE SET status='PROCESSING', requested_by=EXCLUDED.requested_by, error_message=NULL, updated_at=now()
    RETURNING id::text
  `;
  const reviewId = (reviewRows[0] as { id: string }).id;

  const prompt = `Tinjau naskah akademik keperawatan berikut dalam bahasa Indonesia. Mode review: ${parsed.data.mode}.
Instruksi pengelola: ${settings?.custom_instructions || "Utamakan logika ilmiah, konsistensi metode, bahasa akademik, etika penelitian, dan hal yang perlu diverifikasi. Jangan menyatakan plagiarisme dan jangan mengarang sumber."}
Berikan maksimal ${maxFindings} temuan yang konkret dan dapat ditindaklanjuti.\n\nNASKAH:\n${version.extracted_text}`;

  try {
    let items: z.infer<typeof itemSchema>[];
    if (apiKey) {
      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          input: prompt,
          max_output_tokens: 8000,
          text: { format: { type: "json_schema", name: "academic_review", strict: true, schema: {
            type: "object", additionalProperties: false,
            properties: { items: { type: "array", maxItems: maxFindings, items: {
              type: "object", additionalProperties: false,
              properties: {
                category: { type: "string" }, severity: { type: "string", enum: ["MAJOR", "MINOR", "LANGUAGE"] },
                location: { type: ["string", "null"] }, quotation: { type: ["string", "null"] },
                finding: { type: "string" }, rationale: { type: "string" }, suggestion: { type: "string" },
                confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
                examiner_question: { type: ["string", "null"] }, verification_source: { type: ["string", "null"] },
              },
              required: ["category", "severity", "location", "quotation", "finding", "rationale", "suggestion", "confidence", "examiner_question", "verification_source"],
            } } }, required: ["items"],
          } } },
        }),
        signal: AbortSignal.timeout(115_000),
      });
      if (!aiResponse.ok) {
        const body = await aiResponse.text();
        console.error("ai_review_provider_failed", aiResponse.status, body.slice(0, 500));
        throw new Error(`Penyedia AI mengembalikan status ${aiResponse.status}.`);
      }
      const result = await aiResponse.json();
      const output = JSON.parse(extractOutputText(result));
      items = z.array(itemSchema).min(1).max(maxFindings).parse(output.items);
    } else {
      const gatewayModel = model.includes("/") ? model : `openai/${model}`;
      const result = await generateText({
        model: gatewayModel,
        output: Output.object({
          schema: z.object({ items: z.array(itemSchema).min(1).max(maxFindings) }),
        }),
        prompt,
        maxOutputTokens: 8000,
        abortSignal: AbortSignal.timeout(115_000),
        providerOptions: {
          gateway: {
            user: viewer.id,
            tags: ["feature:academic-review", "app:bimbingai"],
          },
        },
      });
      items = result.output.items;
    }
    await sql.transaction((tx) => [
      tx`DELETE FROM public.ai_review_items WHERE ai_review_id=${reviewId}::uuid`,
      ...items.map(item => tx`INSERT INTO public.ai_review_items
        (ai_review_id, category, severity, location, quotation, finding, rationale, suggestion, confidence, examiner_question, verification_source)
        VALUES (${reviewId}::uuid, ${item.category}, ${item.severity}::public.comment_severity,
          ${item.location || null}, ${item.quotation || null}, ${item.finding}, ${item.rationale}, ${item.suggestion},
          ${item.confidence ?? null}, ${item.examiner_question || null}, ${item.verification_source || null})`),
      tx`UPDATE public.ai_reviews SET status='COMPLETED', completed_at=now(), updated_at=now() WHERE id=${reviewId}::uuid`,
    ]);
    return NextResponse.json({ ok: true, reviewId, documentName: version.original_name, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI gagal memproses dokumen.";
    console.error("ai_review_failed", message.slice(0, 500));
    await sql`UPDATE public.ai_reviews SET status='FAILED', error_message=${message.slice(0, 500)}, updated_at=now() WHERE id=${reviewId}::uuid`;
    if (message.includes("valid credit card")) {
      return NextResponse.json({
        error: "AI Gateway Vercel belum dapat digunakan karena akun belum memiliki metode pembayaran. Tambahkan metode pembayaran di Vercel AI Gateway atau simpan OPENAI_API_KEY di Vercel.",
      }, { status: 402 });
    }
    return NextResponse.json({ error: "AI gagal memproses dokumen. Periksa konfigurasi API atau coba kembali." }, { status: 502 });
  }
}
