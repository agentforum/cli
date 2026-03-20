import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import type { SubscriptionRepositoryPort } from "@/domain/ports/repositories.js";
import type { SubscriptionRecord } from "@/domain/subscription.js";
import { getSqlite } from "@/store/db.js";

interface SubscriptionRow {
  id: string;
  actor: string;
  channel: string;
  tag: string | null;
  created_at: string;
}

function mapSubscription(row: SubscriptionRow): SubscriptionRecord {
  return {
    id: row.id,
    actor: row.actor,
    channel: row.channel,
    tag: row.tag,
    createdAt: row.created_at,
  };
}

export class SubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  createMany(subscriptions: SubscriptionRecord[]): SubscriptionRecord[] {
    const statement = this.db().prepare(`
      INSERT INTO subscriptions (id, actor, channel, tag, created_at)
      VALUES (@id, @actor, @channel, @tag, @createdAt)
    `);

    const tx = this.db().transaction((records: SubscriptionRecord[]) => {
      for (const record of records) {
        statement.run(record);
      }
    });

    tx(subscriptions);
    return subscriptions;
  }

  deleteMany(actor: string, channel: string, tags?: string[]): number {
    if (!tags || tags.length === 0) {
      const result = this.db()
        .prepare("DELETE FROM subscriptions WHERE actor = ? AND channel = ?")
        .run(actor, channel);
      return result.changes;
    }

    const placeholders = tags.map(() => "?").join(", ");
    const result = this.db()
      .prepare(
        `DELETE FROM subscriptions WHERE actor = ? AND channel = ? AND tag IN (${placeholders})`
      )
      .run(actor, channel, ...tags);
    return result.changes;
  }

  listByActor(actor: string): SubscriptionRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM subscriptions WHERE actor = ? ORDER BY channel ASC, tag ASC")
      .all(actor) as SubscriptionRow[];
    return rows.map(mapSubscription);
  }

  all(): SubscriptionRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM subscriptions ORDER BY created_at ASC")
      .all() as SubscriptionRow[];
    return rows.map(mapSubscription);
  }
}
