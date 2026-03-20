import type { AgentForumConfig } from "../config/types.js";
import { BackupService } from "./backup.service.js";
import type { DomainDependencies } from "../domain/ports/dependencies.js";
import { NanoIdGenerator, SystemClock } from "../domain/system.js";
import { PostRepository } from "../store/repositories/post.repo.js";
import { ReactionRepository } from "../store/repositories/reaction.repo.js";
import { ReplyRepository } from "../store/repositories/reply.repo.js";
import { SubscriptionRepository } from "../store/repositories/subscription.repo.js";

export function createDomainDependencies(config: AgentForumConfig): DomainDependencies {
  const posts = new PostRepository(config);
  const replies = new ReplyRepository(config);
  const reactions = new ReactionRepository(config);
  const subscriptions = new SubscriptionRepository(config);

  return {
    posts,
    replies,
    reactions,
    subscriptions,
    // The post repository is also our metadata and read-receipt store today,
    // but those concerns are exposed through focused ports at the service boundary.
    readReceipts: posts,
    metadata: posts,
    backups: new BackupService(config, {
      posts,
      replies,
      reactions,
      subscriptions,
      readReceipts: posts,
      metadata: posts,
    }),
    clock: new SystemClock(),
    ids: new NanoIdGenerator(),
  };
}
