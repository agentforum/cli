import type Database from "better-sqlite3";

import type { AgentForumConfig } from "../../config/types.js";
import { AgentForumError } from "../../domain/errors.js";
import type { PostFilters } from "../../domain/filters.js";
import type { MetadataRepositoryPort } from "../../domain/ports/metadata.js";
import type { PostRepositoryPort } from "../../domain/ports/repositories.js";
import type { ReadReceiptRepositoryPort } from "../../domain/ports/read-receipts.js";
import type { ReadReceiptRecord } from "../../domain/read-receipt.js";
import type { PostRecord, PostStatus, PostSummaryRecord } from "../../domain/post.js";
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
  assigned_to: string | null;
  idempotency_key: string | null;
  created_at: string;
}

interface PostSummaryRow extends PostRow {
  last_activity_at: string;
  reply_count: number;
  reaction_count: number;
  last_reply_actor: string | null;
  last_reply_body: string | null;
}

interface ReadReceiptRow {
  id: string;
  session: string;
  post_id: string;
  created_at: string;
  last_read_at: string;
}

const LAST_ACTIVITY_SQL = `MAX(
  posts.created_at,
  COALESCE((SELECT MAX(created_at) FROM replies WHERE post_id = posts.id), posts.created_at),
  COALESCE((SELECT MAX(created_at) FROM reactions WHERE post_id = posts.id), posts.created_at)
)`;

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
    assignedTo: row.assigned_to,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at
  };
}

function mapPostSummary(row: PostSummaryRow): PostSummaryRecord {
  return {
    ...(mapPost(row) as PostRecord),
    lastActivityAt: row.last_activity_at,
    replyCount: row.reply_count,
    reactionCount: row.reaction_count,
    lastReplyExcerpt: row.last_reply_body,
    lastReplyActor: row.last_reply_actor
  };
}

function buildListQuery(filters: PostFilters, selectClause: string): { sql: string; params: Array<string | number> } {
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
    where.push(`(rr.post_id IS NULL OR rr.last_read_at < ${LAST_ACTIVITY_SQL})`);
  }
  if (filters.subscribedForActor) {
    joins.push("INNER JOIN subscriptions s ON s.actor = ?");
    params.push(filters.subscribedForActor);
    where.push("s.channel = posts.channel");
    where.push(`(s.tag IS NULL OR posts.tags LIKE '%"' || s.tag || '"%')`);
  }

  if (filters.channel) {
    where.push("posts.channel = ?");
    params.push(filters.channel);
  }
  if (filters.text) {
    const query = `%${filters.text}%`;
    where.push(`(
      posts.title LIKE ?
      OR posts.body LIKE ?
      OR EXISTS (
        SELECT 1 FROM replies rt
        WHERE rt.post_id = posts.id
        AND rt.body LIKE ?
      )
    )`);
    params.push(query, query, query);
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
  if (filters.replyActor) {
    where.push("EXISTS (SELECT 1 FROM replies ra WHERE ra.post_id = posts.id AND ra.actor = ?)");
    params.push(filters.replyActor);
  }
  if (filters.session) {
    where.push("posts.session = ?");
    params.push(filters.session);
  }
  if (filters.assignedTo) {
    where.push("posts.assigned_to = ?");
    params.push(filters.assignedTo);
  }
  if (filters.waitingForActor) {
    where.push("posts.actor = ?");
    params.push(filters.waitingForActor);
    where.push("posts.status IN ('open', 'needs-clarification')");
    where.push("EXISTS (SELECT 1 FROM replies wr WHERE wr.post_id = posts.id AND wr.actor IS NOT NULL AND wr.actor != ?)");
    params.push(filters.waitingForActor);
  }
  if (filters.since) {
    where.push("posts.created_at >= ?");
    params.push(filters.since);
  }
  if (filters.until) {
    where.push("posts.created_at <= ?");
    params.push(filters.until);
  }
  if (filters.afterId) {
    where.push("posts.created_at > (SELECT created_at FROM posts WHERE id = ?)");
    params.push(filters.afterId);
  }
  if (filters.tag) {
    where.push("posts.tags LIKE ?");
    params.push(`%${JSON.stringify(filters.tag)}%`);
  }

  return {
    sql: [
      selectClause,
      joins.join(" "),
      where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
      "ORDER BY posts.pinned DESC, posts.created_at DESC",
      filters.limit ? `LIMIT ${Number(filters.limit)}` : filters.offset ? "LIMIT -1" : "",
      filters.offset ? `OFFSET ${Number(filters.offset)}` : ""
    ]
      .filter(Boolean)
      .join(" "),
    params
  };
}

export class PostRepository implements PostRepositoryPort, MetadataRepositoryPort, ReadReceiptRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  create(post: PostRecord): PostRecord {
    const statement = this.db().prepare(`
      INSERT INTO posts (
        id, channel, type, title, body, data, severity, status, actor, session, tags,
        pinned, ref_id, blocking, assigned_to, idempotency_key, created_at
      ) VALUES (
        @id, @channel, @type, @title, @body, @data, @severity, @status, @actor, @session, @tags,
        @pinned, @refId, @blocking, @assignedTo, @idempotencyKey, @createdAt
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
    if (filters.afterId && !this.findById(filters.afterId)) {
      throw new AgentForumError(`Post not found: ${filters.afterId}`, 2);
    }
    const { sql, params } = buildListQuery(filters, "SELECT DISTINCT posts.* FROM posts");
    const rows = this.db().prepare(sql).all(...params) as PostRow[];
    return rows.map((row) => mapPost(row) as PostRecord);
  }

  listSummaries(filters: PostFilters = {}): PostSummaryRecord[] {
    if (filters.afterId && !this.findById(filters.afterId)) {
      throw new AgentForumError(`Post not found: ${filters.afterId}`, 2);
    }
    const { sql, params } = buildListQuery(
      filters,
      `SELECT DISTINCT
        posts.*,
        ${LAST_ACTIVITY_SQL} AS last_activity_at,
        (SELECT COUNT(*) FROM replies WHERE post_id = posts.id) AS reply_count,
        (SELECT COUNT(*) FROM reactions WHERE post_id = posts.id) AS reaction_count,
        (SELECT actor FROM replies WHERE post_id = posts.id ORDER BY created_at DESC LIMIT 1) AS last_reply_actor,
        (SELECT body FROM replies WHERE post_id = posts.id ORDER BY created_at DESC LIMIT 1) AS last_reply_body
      FROM posts`
    );
    const rows = this.db().prepare(sql).all(...params) as PostSummaryRow[];
    return rows.map(mapPostSummary);
  }

  updateStatus(id: string, status: PostStatus): PostRecord | null {
    this.db().prepare("UPDATE posts SET status = ? WHERE id = ?").run(status, id);
    return this.findById(id);
  }

  updateAssignment(id: string, assignedTo: string | null): PostRecord | null {
    this.db().prepare("UPDATE posts SET assigned_to = ? WHERE id = ?").run(assignedTo, id);
    return this.findById(id);
  }

  updatePinned(id: string, pinned: boolean): PostRecord | null {
    this.db().prepare("UPDATE posts SET pinned = ? WHERE id = ?").run(pinned ? 1 : 0, id);
    return this.findById(id);
  }

  deleteById(id: string): boolean {
    const db = this.db();
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM read_receipts WHERE post_id = ?").run(id);
      db.prepare("DELETE FROM reactions WHERE post_id = ?").run(id);
      db.prepare("DELETE FROM replies WHERE post_id = ?").run(id);
      const result = db.prepare("DELETE FROM posts WHERE id = ?").run(id);
      return result.changes > 0;
    });
    return tx();
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

  markRead(session: string, postIds: string[], readAt?: string): void {
    if (postIds.length === 0) {
      return;
    }

    const timestamp = readAt ?? new Date().toISOString();
    const statement = this.db().prepare(`
      INSERT INTO read_receipts (id, session, post_id, created_at, last_read_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const updateStatement = this.db().prepare("UPDATE read_receipts SET last_read_at = ? WHERE id = ?");

    const tx = this.db().transaction((ids: string[]) => {
      for (const postId of ids) {
        const existing = this.db()
          .prepare("SELECT id, last_read_at FROM read_receipts WHERE session = ? AND post_id = ?")
          .get(session, postId) as { id: string; last_read_at: string } | undefined;
        if (existing) {
          if (existing.last_read_at < timestamp) {
            updateStatement.run(timestamp, existing.id);
          }
          continue;
        }

        statement.run(`RR-${session}-${postId}`, session, postId, timestamp, timestamp);
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
      createdAt: row.created_at,
      lastReadAt: row.last_read_at
    }));
  }
}
