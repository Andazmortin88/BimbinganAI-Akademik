import "server-only";

import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

export type Viewer = {
  id: string;
  authUserId: string;
  fullName: string;
  email: string;
  role: "ADMIN" | "LECTURER" | "STUDENT";
  status: "PENDING" | "ACTIVE" | "REJECTED" | "DISABLED" | "COMPLETED";
};

export async function getViewer(): Promise<Viewer | null> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return null;

  const sql = getSql();
  const rows = await sql`
    SELECT id::text, auth_user_id::text, full_name, email, role::text, status::text
    FROM public.profiles
    WHERE auth_user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
  const row = rows[0] as {
    id: string;
    auth_user_id: string;
    full_name: string;
    email: string;
    role: Viewer["role"];
    status: Viewer["status"];
  } | undefined;
  if (!row) return null;

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
  };
}

