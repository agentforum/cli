import type { AgentForumConfig } from "./types.js";
import type { BackupServicePort } from "./ports/backup.js";
import type {
  PostRepositoryPort,
  ReactionRepositoryPort,
  ReplyRepositoryPort,
  SubscriptionRepositoryPort
} from "./ports/repositories.js";
import type { ClockPort, IdGeneratorPort } from "./ports/system.js";
import { BackupService } from "./backup.service.js";
import { NanoIdGenerator, SystemClock } from "./system.js";
import { PostRepository } from "../store/repositories/post.repo.js";
import { ReactionRepository } from "../store/repositories/reaction.repo.js";
import { ReplyRepository } from "../store/repositories/reply.repo.js";
import { SubscriptionRepository } from "../store/repositories/subscription.repo.js";

export interface DomainDependencies {
  posts: PostRepositoryPort;
  replies: ReplyRepositoryPort;
  reactions: ReactionRepositoryPort;
  subscriptions: SubscriptionRepositoryPort;
  backups: BackupServicePort;
  clock: ClockPort;
  ids: IdGeneratorPort;
}

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
    backups: new BackupService(config, { posts, replies, reactions, subscriptions }),
    clock: new SystemClock(),
    ids: new NanoIdGenerator()
  };
}
