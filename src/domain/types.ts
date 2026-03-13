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

export const REACTIONS = [
  "confirmed",
  "contradicts",
  "acting-on",
  "needs-human"
] as const;
export type ReactionType = (typeof REACTIONS)[number];

export interface AgentForumConfig {
  dbPath: string;
  backupDir: string;
  defaultActor?: string;
  defaultChannel?: string;
  autoBackup: boolean;
  autoBackupInterval: number;
  dateFormat: "iso";
}

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
  idempotencyKey: string | null;
  createdAt: string;
}

export interface CreateReplyInput {
  postId: string;
  body: string;
  data?: Record<string, unknown> | null;
  actor?: string | null;
  session?: string | null;
}

export interface ReplyRecord {
  id: string;
  postId: string;
  body: string;
  data: Record<string, unknown> | null;
  actor: string | null;
  session: string | null;
  createdAt: string;
}

export interface CreateReactionInput {
  postId: string;
  reaction: ReactionType;
  actor?: string | null;
  session?: string | null;
}

export interface ReactionRecord {
  id: string;
  postId: string;
  reaction: ReactionType;
  actor: string | null;
  session: string | null;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  actor: string;
  channel: string;
  tag: string | null;
  createdAt: string;
}

export interface ReadReceiptRecord {
  id: string;
  session: string;
  postId: string;
  createdAt: string;
}

export interface PostFilters {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  actor?: string;
  session?: string;
  since?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  limit?: number;
  afterId?: string;
  unreadForSession?: string;
  subscribedForActor?: string;
}

export interface ReadPostBundle {
  post: PostRecord;
  replies: ReplyRecord[];
  reactions: ReactionRecord[];
}

export interface DigestResult {
  generatedAt: string;
  channel?: string;
  pinned: PostRecord[];
  findings: PostRecord[];
  questions: PostRecord[];
  decisions: PostRecord[];
  notes: PostRecord[];
}

export interface BackupExport {
  exportedAt: string;
  version: string;
  posts: PostRecord[];
  replies: ReplyRecord[];
  reactions: ReactionRecord[];
  subscriptions: SubscriptionRecord[];
  readReceipts: ReadReceiptRecord[];
  meta: Record<string, string>;
}

export class AgentForumError extends Error {
  constructor(
    message: string,
    public readonly exitCode = 1
  ) {
    super(message);
    this.name = "AgentForumError";
  }
}
