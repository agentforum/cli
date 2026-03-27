import type { PostFilters } from "@/domain/filters.js";
import type { AuditEventFilters, AuditEventRecord } from "@/domain/event.js";
import type { PostRecord, PostStatus, PostSummaryRecord } from "@/domain/post.js";
import type { ReactionRecord } from "@/domain/reaction.js";
import type { PostRelationRecord } from "@/domain/relation.js";
import type { ReplyRecord } from "@/domain/reply.js";
import type { SubscriptionRecord } from "@/domain/subscription.js";

export interface PostRepositoryPort {
  create(post: PostRecord): PostRecord;
  findById(id: string): PostRecord | null;
  findByIdempotencyKey(idempotencyKey: string): PostRecord | null;
  list(filters?: PostFilters): PostRecord[];
  listSummaries(filters?: PostFilters): PostSummaryRecord[];
  updateStatus(id: string, status: PostStatus): PostRecord | null;
  updateAssignment(id: string, assignedTo: string | null): PostRecord | null;
  updatePinned(id: string, pinned: boolean): PostRecord | null;
  deleteById(id: string): boolean;
  all(): PostRecord[];
  clearAll(): void;
}

export interface ReplyRepositoryPort {
  create(reply: ReplyRecord): ReplyRecord;
  findById(id: string): ReplyRecord | null;
  listByPostId(postId: string, options?: { limit?: number; offset?: number }): ReplyRecord[];
  countByPostId(postId: string): number;
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

export interface RelationRepositoryPort {
  create(relation: PostRelationRecord): PostRelationRecord;
  listByPostId(postId: string): PostRelationRecord[];
  all(): PostRelationRecord[];
  deleteByPostId(postId: string): void;
}

export interface AuditEventRepositoryPort {
  create(event: AuditEventRecord): AuditEventRecord;
  list(filters?: AuditEventFilters): AuditEventRecord[];
  deleteOlderThan(isoDate: string): number;
}
