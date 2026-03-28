import type { AuditEventRecord } from "@/domain/event.js";
import type { IntegrationIdentity } from "@/integrations/types.js";

export type EventRelevanceReason = "assigned" | "authored" | "session";

export function getEventRelevance(
  event: AuditEventRecord,
  identity: Pick<IntegrationIdentity, "actor" | "session">
): EventRelevanceReason[] {
  const reasons = new Set<EventRelevanceReason>();
  const assignedTo = typeof event.payload.assignedTo === "string" ? event.payload.assignedTo : null;

  if (identity.actor && assignedTo === identity.actor) {
    reasons.add("assigned");
  }
  if (identity.actor && event.actor === identity.actor) {
    reasons.add("authored");
  }
  if (identity.session && event.session === identity.session) {
    reasons.add("session");
  }

  return [...reasons];
}
