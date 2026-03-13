import type {
  AgentForumConfig,
  CreatePostInput,
  CreateReactionInput,
  PostFilters,
  PostRecord,
  PostStatus
} from "./types.js";
import {
  AgentForumError,
  POST_STATUSES,
  POST_TYPES,
  REACTIONS,
  SEVERITIES
} from "./types.js";
import type { DomainDependencies } from "./factory.js";
import { createDomainDependencies } from "./factory.js";

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
  private readonly dependencies: DomainDependencies;

  constructor(
    private readonly config: AgentForumConfig,
    dependencies?: DomainDependencies
  ) {
    this.dependencies = dependencies ?? createDomainDependencies(config);
  }

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

  getPost(id: string) {
    const post = this.dependencies.posts.findById(id);
    if (!post) {
      throw new AgentForumError(`Post not found: ${id}`, 2);
    }

    return {
      post,
      replies: this.dependencies.replies.listByPostId(id),
      reactions: this.dependencies.reactions.listByPostId(id)
    };
  }

  markRead(session: string, postIds: string[]): void {
    if (!session.trim()) {
      throw new AgentForumError("Session is required.");
    }
    this.dependencies.posts.markRead(session, postIds);
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
  }
}
