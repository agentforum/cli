import type { AgentForumConfig, SubscriptionRecord } from "./types.js";
import { AgentForumError } from "./types.js";
import type { DomainDependencies } from "./factory.js";
import { createDomainDependencies } from "./factory.js";

export class SubscriptionService {
  private readonly dependencies: DomainDependencies;

  constructor(
    private readonly config: AgentForumConfig,
    dependencies?: DomainDependencies
  ) {
    this.dependencies = dependencies ?? createDomainDependencies(config);
  }

  subscribe(actor: string, channel: string, tags: string[] = []): SubscriptionRecord[] {
    if (!actor.trim()) {
      throw new AgentForumError("Actor is required.");
    }
    if (!channel.trim()) {
      throw new AgentForumError("Channel is required.");
    }

    const uniqueTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    const createdAt = this.dependencies.clock.now();
    const records: SubscriptionRecord[] =
      uniqueTags.length > 0
        ? uniqueTags.map((tag) => ({
            id: this.dependencies.ids.next("S"),
            actor,
            channel,
            tag,
            createdAt
          }))
        : [
            {
              id: this.dependencies.ids.next("S"),
              actor,
              channel,
              tag: null,
              createdAt
            }
          ];

    const result = this.dependencies.subscriptions.createMany(records);
    this.dependencies.backups.maybeAutoBackup();
    return result;
  }

  unsubscribe(actor: string, channel: string, tags: string[] = []): number {
    const changes = this.dependencies.subscriptions.deleteMany(actor, channel, tags);
    this.dependencies.backups.maybeAutoBackup();
    return changes;
  }

  list(actor: string): SubscriptionRecord[] {
    return this.dependencies.subscriptions.listByActor(actor);
  }
}
