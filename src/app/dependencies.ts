import type { AgentForumConfig } from "@/config/types.js";
import { normalizeReactionCatalog } from "@/domain/reaction.js";
import { BackupService } from "./backup.service.js";
import type { DomainDependencies } from "@/domain/ports/dependencies.js";
import { NanoIdGenerator, SystemClock } from "@/domain/system.js";
import { AuditEventRepository } from "@/store/repositories/event.repo.js";
import {
  IntegrationCursorRepository,
  IntegrationOperationRepository,
} from "@/store/repositories/integration-state.repo.js";
import { PostRepository } from "@/store/repositories/post.repo.js";
import { ReactionRepository } from "@/store/repositories/reaction.repo.js";
import { RelationRepository } from "@/store/repositories/relation.repo.js";
import { ReplyRepository } from "@/store/repositories/reply.repo.js";
import { SubscriptionRepository } from "@/store/repositories/subscription.repo.js";
import { normalizeRelationCatalog } from "@/domain/relation.js";

export function createDomainDependencies(config: AgentForumConfig): DomainDependencies {
  const posts = new PostRepository(config);
  const replies = new ReplyRepository(config);
  const reactions = new ReactionRepository(config);
  const relations = new RelationRepository(config);
  const subscriptions = new SubscriptionRepository(config);
  const events = new AuditEventRepository(config);
  const integrationOperations = new IntegrationOperationRepository(config);
  const integrationCursors = new IntegrationCursorRepository(config);

  return {
    posts,
    replies,
    reactions,
    subscriptions,
    relations,
    // The post repository is also our metadata and read-receipt store today,
    // but those concerns are exposed through focused ports at the service boundary.
    readReceipts: posts,
    metadata: posts,
    events,
    backups: new BackupService(config, {
      posts,
      replies,
      reactions,
      relations,
      events,
      subscriptions,
      readReceipts: posts,
      metadata: posts,
      integrationOperations,
      integrationCursors,
    }),
    clock: new SystemClock(),
    ids: new NanoIdGenerator(),
    availableReactions: normalizeReactionCatalog(config.reactions),
    availableRelationTypes: normalizeRelationCatalog(config.relationTypes),
  };
}

export function createBackupDependencies(
  config: AgentForumConfig
): ConstructorParameters<typeof BackupService>[1] {
  const domainDependencies = createDomainDependencies(config);
  return {
    ...domainDependencies,
    integrationOperations: new IntegrationOperationRepository(config),
    integrationCursors: new IntegrationCursorRepository(config),
  };
}
