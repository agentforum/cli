import type {
  PostFilters,
  PostRecord,
  PostStatus,
  ReadReceiptRecord,
  ReactionRecord,
  ReplyRecord,
  SubscriptionRecord
} from "../types.js";

export interface PostRepositoryPort {
  create(post: PostRecord): PostRecord;
  findById(id: string): PostRecord | null;
  findByIdempotencyKey(idempotencyKey: string): PostRecord | null;
  list(filters?: PostFilters): PostRecord[];
  updateStatus(id: string, status: PostStatus): PostRecord | null;
  updatePinned(id: string, pinned: boolean): PostRecord | null;
  all(): PostRecord[];
  clearAll(): void;
  setMeta(key: string, value: string): void;
  getMeta(key: string): string | null;
  allMeta(): Record<string, string>;
  markRead(session: string, postIds: string[]): void;
  allReadReceipts(): ReadReceiptRecord[];
}

export interface ReplyRepositoryPort {
  create(reply: ReplyRecord): ReplyRecord;
  listByPostId(postId: string): ReplyRecord[];
  all(): ReplyRecord[];
}

export interface ReactionRepositoryPort {
  create(reaction: ReactionRecord): ReactionRecord;
  listByPostId(postId: string): ReactionRecord[];
  all(): ReactionRecord[];
}

export interface SubscriptionRepositoryPort {
  createMany(subscriptions: SubscriptionRecord[]): SubscriptionRecord[];
  deleteMany(actor: string, channel: string, tags?: string[]): number;
  listByActor(actor: string): SubscriptionRecord[];
  all(): SubscriptionRecord[];
}
