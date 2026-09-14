import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ status: z.enum(["ACTIVE", "REJECTED"]) });

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { data: session } = await auth.getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Sesi berakhir. Silakan login kembali." }, { status: 401 });
  }

  const parsedParams = paramsSchema.safeParse(await context.params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const sql = getSql();
  const administrators = await sql`
    SELECT id FROM public.profiles
    WHERE auth_user_id = ${session.user.id}::uuid
      AND role = 'ADMIN' AND status = 'ACTIVE'
    LIMIT 1
  `;
  if (!administrators[0]) {
    return NextResponse.json({ error: "Hanya Administrator yang dapat mengubah status." }, { status: 403 });
  }

  const updated = await sql`
    UPDATE public.profiles
    SET status = ${parsedBody.data.status}::public.account_status, updated_at = now()
    WHERE id = ${parsedParams.data.id}::uuid AND role = 'STUDENT'
    RETURNING id::text, full_name, status::text
  `;
  if (!updated[0]) {
    return NextResponse.json({ error: "Mahasiswa tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, student: updated[0] });
}
