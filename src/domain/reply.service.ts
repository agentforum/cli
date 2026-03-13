import type { AgentForumConfig, CreateReplyInput, ReplyRecord } from "./types.js";
import { AgentForumError } from "./types.js";
import type { DomainDependencies } from "./factory.js";
import { createDomainDependencies } from "./factory.js";

export class ReplyService {
  private readonly dependencies: DomainDependencies;

  constructor(
    private readonly config: AgentForumConfig,
    dependencies?: DomainDependencies
  ) {
    this.dependencies = dependencies ?? createDomainDependencies(config);
  }

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
