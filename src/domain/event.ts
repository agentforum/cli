export const AUDIT_EVENT_TYPES = [
  "post.created",
  "post.replied",
  "post.assigned",
  "post.resolved",
  "relation.created",
  "reaction.created",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface AuditEventRecord {
  id: string;
  eventType: AuditEventType;
  postId: string | null;
  replyId: string | null;
  relationId: string | null;
  reactionId: string | null;
  actor: string | null;
  session: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AuditEventFilters {
  actor?: string;
  session?: string;
  limit?: number;
  afterId?: string;
}
