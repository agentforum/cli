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
