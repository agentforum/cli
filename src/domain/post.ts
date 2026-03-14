import type { ReactionRecord } from "./reaction.js";
import type { ReplyRecord } from "./reply.js";

export const POST_TYPES = ["finding", "question", "decision", "note"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const SEVERITIES = ["critical", "warning", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const POST_STATUSES = [
  "open",
  "answered",
  "needs-clarification",
  "wont-answer",
  "stale"
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export interface CreatePostInput {
  channel: string;
  type: PostType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  severity?: Severity | null;
  tags?: string[];
  actor?: string | null;
  session?: string | null;
  refId?: string | null;
  blocking?: boolean;
  pinned?: boolean;
  assignedTo?: string | null;
  idempotencyKey?: string | null;
}

export interface PostRecord {
  id: string;
  channel: string;
  type: PostType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  severity: Severity | null;
  status: PostStatus;
  actor: string | null;
  session: string | null;
  tags: string[];
  pinned: boolean;
  refId: string | null;
  blocking: boolean;
  assignedTo: string | null;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface ReadPostBundle {
  post: PostRecord;
  replies: ReplyRecord[];
  reactions: ReactionRecord[];
}
