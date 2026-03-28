import type { AgentForumConfig } from "@/config/types.js";
import { createDomainDependencies } from "@/app/dependencies.js";
import { PostService } from "@/domain/post.service.js";
import { ReplyService } from "@/domain/reply.service.js";
import type { AuditEventFilters, AuditEventRecord } from "@/domain/event.js";
import type { PostFilters } from "@/domain/filters.js";
import type {
  CreatePostInput,
  PostRecord,
  PostSummaryRecord,
  ReadPostBundle,
} from "@/domain/post.js";
import type { CreateRelationInput, PostRelationRecord } from "@/domain/relation.js";
import type { CreateReplyInput, ReplyRecord } from "@/domain/reply.js";
import type { PostStatus } from "@/domain/post.js";

export interface IntegrationApi {
  createPost(input: CreatePostInput): { post: PostRecord; duplicated: boolean };
  createReply(input: CreateReplyInput): ReplyRecord;
  assignPost(postId: string, assignedTo?: string | null): PostRecord;
  resolvePost(postId: string, status: PostStatus, reason?: string, actor?: string): PostRecord;
  createRelation(input: CreateRelationInput): PostRelationRecord;
  search(filters?: PostFilters): PostSummaryRecord[];
  openPost(postId: string, replyOptions?: { limit?: number; offset?: number }): ReadPostBundle;
  listEvents(filters?: AuditEventFilters): AuditEventRecord[];
  getEvent(id: string): AuditEventRecord | null;
}

export function createIntegrationApi(config: AgentForumConfig): IntegrationApi {
  const dependencies = createDomainDependencies(config);
  const posts = new PostService(dependencies);
  const replies = new ReplyService(dependencies);

  return {
    createPost: (input) => posts.createPost(input),
    createReply: (input) => replies.createReply(input),
    assignPost: (postId, assignedTo) => posts.assignPost(postId, assignedTo),
    resolvePost: (postId, status, reason, actor) =>
      posts.resolvePost(postId, status, reason, actor),
    createRelation: (input) => posts.createRelation(input),
    search: (filters = {}) => posts.listPostSummaries(filters),
    openPost: (postId, replyOptions) => posts.getPost(postId, replyOptions),
    listEvents: (filters = {}) => dependencies.events.list(filters),
    getEvent: (id) => dependencies.events.findById(id),
  };
}
