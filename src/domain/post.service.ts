import { AgentForumError } from "./errors.js";
import type { PostFilters } from "./filters.js";
import { POST_STATUSES, POST_TYPES, type CreatePostInput, type PostRecord, type PostStatus, type PostSummaryRecord, SEVERITIES } from "./post.js";
import { REACTIONS, type CreateReactionInput } from "./reaction.js";
import type { DomainDependencies } from "./ports/dependencies.js";

interface CreatePostResult {
  post: PostRecord;
  duplicated: boolean;
}

interface CreateReactionResult {
  reaction: {
    id: string;
    postId: string;
    reaction: CreateReactionInput["reaction"];
    actor: string | null;
    session: string | null;
    createdAt: string;
  };
}

export class PostService {
  constructor(private readonly dependencies: DomainDependencies) {}

  createPost(input: CreatePostInput): CreatePostResult {
    this.validatePostInput(input);

    if (input.idempotencyKey) {
      const existing = this.dependencies.posts.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return { post: existing, duplicated: true };
      }
    }

    const post: PostRecord = {
      id: this.dependencies.ids.next("P"),
      channel: input.channel,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? null,
      severity: input.severity ?? null,
      status: "open",
      actor: input.actor ?? null,
      session: input.session ?? null,
      tags: input.tags ?? [],
      pinned: input.pinned ?? false,
      refId: input.refId ?? null,
      blocking: input.blocking ?? false,
      assignedTo: input.assignedTo ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: this.dependencies.clock.now()
    };

    this.dependencies.posts.create(post);
    this.dependencies.backups.maybeAutoBackup();
    return { post, duplicated: false };
  }

  listPosts(filters: PostFilters = {}): PostRecord[] {
    return this.dependencies.posts.list(filters);
  }

  listPostSummaries(filters: PostFilters = {}): PostSummaryRecord[] {
    return this.dependencies.posts.listSummaries(filters);
  }

  getPost(id: string, replyOptions?: { limit?: number; offset?: number }) {
    const post = this.dependencies.posts.findById(id);
    if (!post) {
      throw new AgentForumError(`Post not found: ${id}`, 2);
    }

    return {
      post,
      replies: this.dependencies.replies.listByPostId(id, replyOptions),
      totalReplies: this.dependencies.replies.countByPostId(id),
      reactions: this.dependencies.reactions.listByPostId(id)
    };
  }

  markRead(session: string, postIds: string[]): void {
    if (!session.trim()) {
      throw new AgentForumError("Session is required.");
    }
    this.dependencies.readReceipts.markRead(session, postIds);
    this.dependencies.backups.maybeAutoBackup();
  }

  resolvePost(id: string, status: PostStatus, reason?: string, actor?: string): PostRecord {
    if (!POST_STATUSES.includes(status)) {
      throw new AgentForumError(`Invalid status: ${status}`);
    }

    const current = this.dependencies.posts.findById(id);
    if (!current) {
      throw new AgentForumError(`Post not found: ${id}`, 2);
    }
    if (!this.canTransition(current.status, status)) {
      throw new AgentForumError(`Invalid status transition: ${current.status} -> ${status}`);
    }
    this.assertResolveAuthority(current.id, status, actor);

    if ((status === "wont-answer" || status === "stale") && !reason?.trim()) {
      throw new AgentForumError(`--reason is required for status ${status}`);
    }

    const updated = this.dependencies.posts.updateStatus(id, status);
    this.dependencies.backups.maybeAutoBackup();

    if (!updated) {
      throw new AgentForumError(`Unable to update post: ${id}`, 1);
    }

    if (reason || actor) {
      this.dependencies.replies.create({
        id: this.dependencies.ids.next("R"),
        postId: id,
        body: reason ?? `Status changed to ${status}.`,
        data: null,
        actor: actor ?? null,
        session: null,
        createdAt: this.dependencies.clock.now()
      });
    }

    return updated;
  }

  assignPost(id: string, assignedTo?: string | null): PostRecord {
    const post = this.dependencies.posts.findById(id);
    if (!post) {
      throw new AgentForumError(`Post not found: ${id}`, 2);
    }

    const normalizedAssignee = assignedTo?.trim() ? assignedTo.trim() : null;
    const updated = this.dependencies.posts.updateAssignment(id, normalizedAssignee);
    if (!updated) {
      throw new AgentForumError(`Unable to assign post: ${id}`, 1);
    }

    this.dependencies.backups.maybeAutoBackup();
    return updated;
  }

  deletePost(id: string): void {
    const post = this.dependencies.posts.findById(id);
    if (!post) {
      throw new AgentForumError(`Post not found: ${id}`, 2);
    }

    const deleted = this.dependencies.posts.deleteById(id);
    if (!deleted) {
      throw new AgentForumError(`Unable to delete post: ${id}`, 1);
    }

    this.dependencies.backups.maybeAutoBackup();
  }

  pinPost(id: string, pinned: boolean): PostRecord {
    const updated = this.dependencies.posts.updatePinned(id, pinned);
    if (!updated) {
      throw new AgentForumError(`Post not found: ${id}`, 2);
    }
    this.dependencies.backups.maybeAutoBackup();
    return updated;
  }

  createReaction(input: CreateReactionInput): CreateReactionResult {
    if (!REACTIONS.includes(input.reaction)) {
      throw new AgentForumError(`Invalid reaction: ${input.reaction}`);
    }

    if (!this.dependencies.posts.findById(input.postId)) {
      throw new AgentForumError(`Post not found: ${input.postId}`, 2);
    }

    const reaction = this.dependencies.reactions.create({
      id: this.dependencies.ids.next("X"),
      postId: input.postId,
      reaction: input.reaction,
      actor: input.actor ?? null,
      session: input.session ?? null,
      createdAt: this.dependencies.clock.now()
    });

    this.dependencies.backups.maybeAutoBackup();
    return { reaction };
  }

  private canTransition(current: PostStatus, next: PostStatus): boolean {
    const transitions: Record<PostStatus, PostStatus[]> = {
      open: ["answered", "needs-clarification", "wont-answer", "stale"],
      answered: ["needs-clarification", "stale"],
      "needs-clarification": ["answered", "wont-answer", "stale"],
      "wont-answer": [],
      stale: ["answered", "wont-answer"]
    };

    return current === next || transitions[current].includes(next);
  }

  private assertResolveAuthority(postId: string, status: PostStatus, actor?: string): void {
    if (status === "answered") {
      const post = this.dependencies.posts.findById(postId);
      if (!post?.actor) {
        throw new AgentForumError("Only the original post author can mark a thread as answered.");
      }
      if (!actor || actor !== post.actor) {
        throw new AgentForumError(`Only ${post.actor} can mark this thread as answered.`);
      }
      return;
    }

    if (status === "needs-clarification") {
      if (!actor) {
        throw new AgentForumError("--actor is required for status needs-clarification.");
      }

      const post = this.dependencies.posts.findById(postId);
      const replies = this.dependencies.replies.listByPostId(postId);
      const isParticipant = post?.actor === actor || replies.some((reply) => reply.actor === actor);
      if (!isParticipant) {
        throw new AgentForumError(`Only a participant can mark this thread as ${status}.`);
      }
    }
  }

  private validatePostInput(input: CreatePostInput): void {
    if (!input.channel.trim()) {
      throw new AgentForumError("Channel is required.");
    }
    if (!POST_TYPES.includes(input.type)) {
      throw new AgentForumError(`Invalid post type: ${input.type}`);
    }
    if (!input.title.trim()) {
      throw new AgentForumError("Title is required.");
    }
    if (!input.body.trim()) {
      throw new AgentForumError("Body is required.");
    }
    if (input.type === "finding" && !input.severity) {
      throw new AgentForumError("Severity is required for findings.");
    }
    if (input.severity && !SEVERITIES.includes(input.severity)) {
      throw new AgentForumError(`Invalid severity: ${input.severity}`);
    }
    if (input.refId && !this.dependencies.posts.findById(input.refId)) {
      throw new AgentForumError(`Referenced post not found: ${input.refId}`, 2);
    }
    if (input.assignedTo !== undefined && input.assignedTo !== null && !input.assignedTo.trim()) {
      throw new AgentForumError("Assigned actor cannot be empty.");
    }
  }
}
