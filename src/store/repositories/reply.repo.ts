import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import type { ReplyRepositoryPort } from "@/domain/ports/repositories.js";
import type { ReplyRecord } from "@/domain/reply.js";
import { getSqlite } from "@/store/db.js";

interface ReplyRow {
  id: string;
  post_id: string;
  body: string;
  data: string | null;
  actor: string | null;
  session: string | null;
  created_at: string;
}

function mapReply(row: ReplyRow): ReplyRecord {
  return {
    id: row.id,
    postId: row.post_id,
    body: row.body,
    data: row.data ? JSON.parse(row.data) : null,
    actor: row.actor,
    session: row.session,
    createdAt: row.created_at,
  };
}

export class ReplyRepository implements ReplyRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  create(reply: ReplyRecord): ReplyRecord {
    this.db()
      .prepare(
        `
        INSERT INTO replies (id, post_id, body, data, actor, session, created_at)
        VALUES (@id, @postId, @body, @data, @actor, @session, @createdAt)
      `
      )
      .run({
        ...reply,
        data: reply.data ? JSON.stringify(reply.data) : null,
      });

    return reply;
  }

  findById(id: string): ReplyRecord | null {
    const row = this.db().prepare("SELECT * FROM replies WHERE id = ?").get(id) as
      | ReplyRow
      | undefined;
    return row ? mapReply(row) : null;
  }

  listByPostId(postId: string, options?: { limit?: number; offset?: number }): ReplyRecord[] {
    const limitClause = options?.limit ? `LIMIT ${options.limit}` : "";
    const offsetClause = options?.offset ? `OFFSET ${options.offset}` : "";
    const rows = this.db()
      .prepare(
        `SELECT * FROM replies WHERE post_id = ? ORDER BY created_at ASC ${limitClause} ${offsetClause}`
      )
      .all(postId) as ReplyRow[];
    return rows.map(mapReply);
  }

  countByPostId(postId: string): number {
    const row = this.db()
      .prepare("SELECT COUNT(*) as n FROM replies WHERE post_id = ?")
      .get(postId) as { n: number };
    return row.n;
  }

  all(): ReplyRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM replies ORDER BY created_at ASC")
      .all() as ReplyRow[];
    return rows.map(mapReply);
  }
}
