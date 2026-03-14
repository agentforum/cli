import type {
  PostFilters
} from "../filters.js";
import type { PostRecord, PostStatus } from "../post.js";
import type { ReactionRecord } from "../reaction.js";
import type { ReplyRecord } from "../reply.js";
import type { SubscriptionRecord } from "../subscription.js";

export interface PostRepositoryPort {
  create(post: PostRecord): PostRecord;
  findById(id: string): PostRecord | null;
  findByIdempotencyKey(idempotencyKey: string): PostRecord | null;
  list(filters?: PostFilters): PostRecord[];
  updateStatus(id: string, status: PostStatus): PostRecord | null;
  updateAssignment(id: string, assignedTo: string | null): PostRecord | null;
  updatePinned(id: string, pinned: boolean): PostRecord | null;
  deleteById(id: string): boolean;
  all(): PostRecord[];
  clearAll(): void;
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
