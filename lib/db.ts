import "server-only";

import { neon } from "@neondatabase/serverless";

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL Neon belum dikonfigurasi.");
  return neon(databaseUrl);
}
