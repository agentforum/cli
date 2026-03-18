import type { ReadReceiptRecord } from "./read-receipt.js";
import type { PostRecord } from "./post.js";
import type { ReactionRecord } from "./reaction.js";
import type { ReplyRecord } from "./reply.js";
import type { SubscriptionRecord } from "./subscription.js";

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

export interface BackupImportCounts {
  total: number;
  posts: number;
  replies: number;
  reactions: number;
  subscriptions: number;
  readReceipts: number;
  meta: number;
}

export interface BackupImportConflict {
  entity: keyof Omit<BackupImportCounts, "total">;
  key: string;
  reason: string;
}

export interface BackupImportConflicts {
  total: number;
  items: BackupImportConflict[];
}

export interface BackupImportReport {
  mode: "merge";
  file: string;
  created: BackupImportCounts;
  skipped: BackupImportCounts;
  conflicts: BackupImportConflicts;
}
