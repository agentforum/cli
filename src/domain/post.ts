import type { ReactionRecord } from "./reaction.js";
import type { PostRelationRecord } from "./relation.js";
import type { ReplyRecord } from "./reply.js";

export type PostType = string;

export const SEVERITIES = ["critical", "warning", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const POST_STATUSES = [
  "open",
  "answered",
  "needs-clarification",
  "wont-answer",
  "stale",
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

export const SEARCH_MATCH_KINDS = [
  "title",
  "tag",
  "author",
  "session",
  "assigned",
  "body",
  "reply-author",
  "reply-session",
  "reply-body",
] as const;
export type SearchMatchKind = (typeof SEARCH_MATCH_KINDS)[number];

export interface SearchMatchRecord {
  kind: SearchMatchKind;
  kinds: SearchMatchKind[];
  excerpt: string;
  rank: number;
}

export interface PostSummaryRecord extends PostRecord {
  lastActivityAt: string;
  replyCount: number;
  reactionCount: number;
  lastReplyExcerpt: string | null;
  lastReplyActor: string | null;
  searchMatch: SearchMatchRecord | null;
}

export interface ReadPostBundle {
  post: PostRecord;
  replies: ReplyRecord[];
  totalReplies: number;
  reactions: ReactionRecord[];
  replyReactions?: ReactionRecord[];
  relations?: PostRelationRecord[];
}
