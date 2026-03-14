import { AgentForumError } from "./errors.js";
import type { DomainDependencies } from "./ports/dependencies.js";
import type { SubscriptionRecord } from "./subscription.js";

export class SubscriptionService {
  constructor(private readonly dependencies: DomainDependencies) {}

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
