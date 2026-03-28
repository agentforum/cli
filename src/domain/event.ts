export const AUDIT_EVENT_TYPES = [
  "post.created",
  "post.replied",
  "post.assigned",
  "post.resolved",
  "relation.created",
  "reaction.created",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface AuditEventPayloadMap {
  "post.created": {
    channel: string;
    type: string;
    status: string;
    severity: string | null;
    assignedTo: string | null;
    title: string;
    refId: string | null;
  };
  "post.replied": {
    body: string;
    status?: string;
  };
  "post.assigned": {
    assignedTo: string | null;
    previousAssignedTo: string | null;
  };
  "post.resolved": {
    status: string;
    reason: string | null;
  };
  "relation.created": {
    toPostId: string;
    relationType: string;
  };
  "reaction.created": {
    targetType: string;
    targetId: string;
    reaction: string;
  };
}

export type AuditEventPayload = AuditEventPayloadMap[AuditEventType];

interface AuditEventRecordBase<T extends AuditEventType> {
  id: string;
  eventType: T;
  postId: string | null;
  replyId: string | null;
  relationId: string | null;
  reactionId: string | null;
  actor: string | null;
  session: string | null;
  payload: AuditEventPayloadMap[T];
  createdAt: string;
}

export type AuditEventRecord = {
  [T in AuditEventType]: AuditEventRecordBase<T>;
}[AuditEventType];

export interface AuditEventFilters {
  actor?: string;
  session?: string;
  limit?: number;
  afterId?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isAuditEventPayload<T extends AuditEventType>(
  eventType: T,
  payload: unknown
): payload is AuditEventPayloadMap[T] {
  if (!isObject(payload)) {
    return false;
  }

  switch (eventType) {
    case "post.created":
      return (typeof payload.channel === "string" &&
        typeof payload.type === "string" &&
        typeof payload.status === "string" &&
        (typeof payload.severity === "string" || payload.severity === null) &&
        (typeof payload.assignedTo === "string" || payload.assignedTo === null) &&
        typeof payload.title === "string" &&
        (typeof payload.refId === "string" || payload.refId === null)) as boolean;
    case "post.replied":
      return (
        typeof payload.body === "string" &&
        (!("status" in payload) || typeof payload.status === "string")
      );
    case "post.assigned":
      return ((typeof payload.assignedTo === "string" || payload.assignedTo === null) &&
        (typeof payload.previousAssignedTo === "string" ||
          payload.previousAssignedTo === null)) as boolean;
    case "post.resolved":
      return (typeof payload.status === "string" &&
        (typeof payload.reason === "string" || payload.reason === null)) as boolean;
    case "relation.created":
      return typeof payload.toPostId === "string" && typeof payload.relationType === "string";
    case "reaction.created":
      return (typeof payload.targetType === "string" &&
        typeof payload.targetId === "string" &&
        typeof payload.reaction === "string") as boolean;
    default:
      return false;
  }
}
