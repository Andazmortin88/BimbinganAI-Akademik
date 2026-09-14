import "server-only";

import type { NeonQueryFunction } from "@neondatabase/serverless";

type AuditInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(sql: NeonQueryFunction<false, false>, input: AuditInput): Promise<void> {
  await sql`
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (${input.actorId}::uuid, ${input.action}, ${input.entityType}, ${input.entityId}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `;
}
