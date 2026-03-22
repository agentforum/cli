import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import type { ReactionRepositoryPort } from "@/domain/ports/repositories.js";
import type { ReactionRecord } from "@/domain/reaction.js";
import { getSqlite } from "@/store/db.js";

interface ReactionRow {
  id: string;
  post_id: string;
  target_type: ReactionRecord["targetType"] | null;
  target_id: string | null;
  reaction: ReactionRecord["reaction"];
  actor: string | null;
  session: string | null;
  created_at: string;
}

function mapReaction(row: ReactionRow): ReactionRecord {
  return {
    id: row.id,
    postId: row.post_id,
    targetType: row.target_type ?? "post",
    targetId: row.target_id ?? row.post_id,
    reaction: row.reaction,
    actor: row.actor,
    session: row.session,
    createdAt: row.created_at,
  };
}

export class ReactionRepository implements ReactionRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  create(reaction: ReactionRecord): ReactionRecord {
    this.db()
      .prepare(
        `
        INSERT INTO reactions (id, post_id, target_type, target_id, reaction, actor, session, created_at)
        VALUES (@id, @postId, @targetType, @targetId, @reaction, @actor, @session, @createdAt)
      `
      )
      .run(reaction);

    return reaction;
  }

  listByPostId(postId: string): ReactionRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM reactions WHERE post_id = ? ORDER BY created_at ASC")
      .all(postId) as ReactionRow[];
    return rows.map(mapReaction);
  }

  all(): ReactionRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM reactions ORDER BY created_at ASC")
      .all() as ReactionRow[];
    return rows.map(mapReaction);
  }
}
