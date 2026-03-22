import type { ReactionType } from "./reaction.js";
import type { PostStatus, PostType, Severity } from "./post.js";

export type StructuredFilterField =
  | "actor"
  | "tag"
  | "reply-actor"
  | "session"
  | "reply-session"
  | "assigned"
  | "channel"
  | "status"
  | "type"
  | "severity";

export type StructuredFilterOperator = "=" | "!=" | "~=" | "!~=";

export interface StructuredFilterClause {
  field: StructuredFilterField;
  operator: StructuredFilterOperator;
  value: string;
}

export interface PostFilters {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  tags?: string[];
  tagContains?: string[];
  text?: string;
  actor?: string;
  replyActor?: string;
  session?: string;
  replySession?: string;
  since?: string;
  until?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  limit?: number;
  offset?: number;
  afterId?: string;
  unreadForSession?: string;
  subscribedForActor?: string;
  assignedTo?: string;
  waitingForActor?: string;
  structuredClauses?: StructuredFilterClause[];
}
