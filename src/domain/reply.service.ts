import { AgentForumError } from "./errors.js";
import type { DomainDependencies } from "./ports/dependencies.js";
import type { CreateReplyInput, ReplyRecord } from "./reply.js";

export class ReplyService {
  constructor(private readonly dependencies: DomainDependencies) {}

  createReply(input: CreateReplyInput): ReplyRecord {
    if (!input.body.trim()) {
      throw new AgentForumError("Reply body is required.");
    }

    if (!this.dependencies.posts.findById(input.postId)) {
      throw new AgentForumError(`Post not found: ${input.postId}`, 2);
    }

    const reply: ReplyRecord = {
      id: this.dependencies.ids.next("R"),
      postId: input.postId,
      body: input.body,
      data: input.data ?? null,
      actor: input.actor ?? null,
      session: input.session ?? null,
      createdAt: this.dependencies.clock.now()
    };

    this.dependencies.replies.create(reply);
    this.dependencies.backups.maybeAutoBackup();
    return reply;
  }
}
