import type Database from "better-sqlite3";

import type {
  AgentForumConfig,
  PostFilters,
  PostRecord,
  ReadReceiptRecord,
  PostStatus
} from "../../domain/types.js";
import { AgentForumError } from "../../domain/types.js";
import type { PostRepositoryPort } from "../../domain/ports/repositories.js";
import { getSqlite } from "../db.js";

interface PostRow {
  id: string;
  channel: string;
  type: PostRecord["type"];
  title: string;
  body: string;
  data: string | null;
  severity: PostRecord["severity"];
  status: PostStatus;
  actor: string | null;
  session: string | null;
  tags: string;
  pinned: number;
  ref_id: string | null;
  blocking: number;
  idempotency_key: string | null;
  created_at: string;
}

interface ReadReceiptRow {
  id: string;
  session: string;
  post_id: string;
  created_at: string;
}

function mapPost(row: PostRow | undefined): PostRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    channel: row.channel,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ? JSON.parse(row.data) : null,
    severity: row.severity,
    status: row.status,
    actor: row.actor,
    session: row.session,
    tags: JSON.parse(row.tags),
    pinned: Boolean(row.pinned),
    refId: row.ref_id,
    blocking: Boolean(row.blocking),
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at
  };
}

export class PostRepository implements PostRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  create(post: PostRecord): PostRecord {
    const statement = this.db().prepare(`
      INSERT INTO posts (
        id, channel, type, title, body, data, severity, status, actor, session, tags,
        pinned, ref_id, blocking, idempotency_key, created_at
      ) VALUES (
        @id, @channel, @type, @title, @body, @data, @severity, @status, @actor, @session, @tags,
        @pinned, @refId, @blocking, @idempotencyKey, @createdAt
      )
    `);

    try {
      statement.run({
        ...post,
        data: post.data ? JSON.stringify(post.data) : null,
        tags: JSON.stringify(post.tags),
        pinned: post.pinned ? 1 : 0,
        blocking: post.blocking ? 1 : 0
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: posts.idempotency_key")) {
        throw new AgentForumError("Idempotency key already exists.", 4);
      }
      throw error;
    }

    return post;
  }

  findById(id: string): PostRecord | null {
    const row = this.db().prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow | undefined;
    return mapPost(row);
  }

  findByIdempotencyKey(idempotencyKey: string): PostRecord | null {
    const row = this.db()
      .prepare("SELECT * FROM posts WHERE idempotency_key = ?")
      .get(idempotencyKey) as PostRow | undefined;
    return mapPost(row);
  }

  list(filters: PostFilters = {}): PostRecord[] {
    const joins: string[] = [];
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.reaction) {
      joins.push("INNER JOIN reactions r ON r.post_id = posts.id");
      where.push("r.reaction = ?");
      params.push(filters.reaction);
    }
    if (filters.unreadForSession) {
      joins.push("LEFT JOIN read_receipts rr ON rr.post_id = posts.id AND rr.session = ?");
      params.push(filters.unreadForSession);
      where.push("rr.post_id IS NULL");
    }
    if (filters.subscribedForActor) {
      joins.push("INNER JOIN subscriptions s ON s.actor = ?");
      params.push(filters.subscribedForActor);
      where.push("s.channel = posts.channel");
      where.push("(s.tag IS NULL OR posts.tags LIKE '%' || s.tag || '%')");
    }

    if (filters.channel) {
      where.push("posts.channel = ?");
      params.push(filters.channel);
    }
    if (filters.type) {
      where.push("posts.type = ?");
      params.push(filters.type);
    }
    if (filters.severity) {
      where.push("posts.severity = ?");
      params.push(filters.severity);
    }
    if (filters.status) {
      where.push("posts.status = ?");
      params.push(filters.status);
    }
    if (typeof filters.pinned === "boolean") {
      where.push("posts.pinned = ?");
      params.push(filters.pinned ? 1 : 0);
    }
    if (filters.actor) {
      where.push("posts.actor = ?");
      params.push(filters.actor);
    }
    if (filters.session) {
      where.push("posts.session = ?");
      params.push(filters.session);
    }
    if (filters.since) {
      where.push("posts.created_at >= ?");
      params.push(filters.since);
    }
    if (filters.afterId) {
      where.push("posts.created_at > COALESCE((SELECT created_at FROM posts WHERE id = ?), '')");
      params.push(filters.afterId);
    }
    if (filters.tag) {
      where.push("posts.tags LIKE ?");
      params.push(`%${JSON.stringify(filters.tag).slice(1, -1)}%`);
    }

    const sql = [
      "SELECT DISTINCT posts.* FROM posts",
      joins.join(" "),
      where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
      "ORDER BY posts.pinned DESC, posts.created_at DESC",
      filters.limit ? `LIMIT ${Number(filters.limit)}` : ""
    ]
      .filter(Boolean)
      .join(" ");

    const rows = this.db().prepare(sql).all(...params) as PostRow[];
    return rows.map((row) => mapPost(row) as PostRecord);
  }

  updateStatus(id: string, status: PostStatus): PostRecord | null {
    this.db().prepare("UPDATE posts SET status = ? WHERE id = ?").run(status, id);
    return this.findById(id);
  }

  updatePinned(id: string, pinned: boolean): PostRecord | null {
    this.db().prepare("UPDATE posts SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, id);
    return this.findById(id);
  }

  all(): PostRecord[] {
    return this.list();
  }

  clearAll(): void {
    this.db().prepare("DELETE FROM read_receipts").run();
    this.db().prepare("DELETE FROM subscriptions").run();
    this.db().prepare("DELETE FROM replies").run();
    this.db().prepare("DELETE FROM reactions").run();
    this.db().prepare("DELETE FROM posts").run();
    this.db().prepare("DELETE FROM meta").run();
  }

  setMeta(key: string, value: string): void {
    this.db()
      .prepare(`
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value);
  }

  getMeta(key: string): string | null {
    const row = this.db().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  allMeta(): Record<string, string> {
    const rows = this.db().prepare("SELECT key, value FROM meta").all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  markRead(session: string, postIds: string[]): void {
    if (postIds.length === 0) {
      return;
    }

    const statement = this.db().prepare(`
      INSERT INTO read_receipts (id, session, post_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const tx = this.db().transaction((ids: string[]) => {
      for (const postId of ids) {
        const existing = this.db()
          .prepare("SELECT id FROM read_receipts WHERE session = ? AND post_id = ?")
          .get(session, postId) as { id: string } | undefined;
        if (!existing) {
          statement.run(`RR-${session}-${postId}`, session, postId, new Date().toISOString());
        }
      }
    });

    tx(postIds);
  }

  allReadReceipts(): ReadReceiptRecord[] {
    const rows = this.db().prepare("SELECT * FROM read_receipts ORDER BY created_at ASC").all() as ReadReceiptRow[];
    return rows.map((row) => ({
      id: row.id,
      session: row.session,
      postId: row.post_id,
      createdAt: row.created_at
    }));
  }
}
