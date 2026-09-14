import { NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { getViewer } from "@/lib/viewer";

const settingsSchema = z.object({
  enabled: z.boolean(),
  modelName: z.string().trim().regex(/^[A-Za-z0-9._:-]{2,100}$/),
  customInstructions: z.string().trim().min(20).max(5000),
  maxFindings: z.number().int().min(1).max(30),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "ADMIN" || viewer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Hanya administrator yang dapat mengatur AI Review." }, { status: 403 });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Konfigurasi AI tidak valid." }, { status: 400 });

  const sql = getSql();
  await sql`
    INSERT INTO public.ai_review_settings
      (id, enabled, model_name, custom_instructions, max_findings, updated_by)
    VALUES (1, ${parsed.data.enabled}, ${parsed.data.modelName}, ${parsed.data.customInstructions},
      ${parsed.data.maxFindings}, ${viewer.id}::uuid)
    ON CONFLICT (id) DO UPDATE SET
      enabled=EXCLUDED.enabled, model_name=EXCLUDED.model_name,
      custom_instructions=EXCLUDED.custom_instructions, max_findings=EXCLUDED.max_findings,
      updated_by=EXCLUDED.updated_by, updated_at=now()
  `;
  return NextResponse.json({
    ok: true,
    apiConfigured: Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.AI_API_KEY ||
      process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL,
    ),
  });
}
