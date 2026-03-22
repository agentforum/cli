import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";
import type { PostFilters, StructuredFilterClause } from "@/domain/filters.js";
import type { MetadataRepositoryPort } from "@/domain/ports/metadata.js";
import type { PostRepositoryPort } from "@/domain/ports/repositories.js";
import type { ReadReceiptRepositoryPort } from "@/domain/ports/read-receipts.js";
import type { ReadReceiptRecord } from "@/domain/read-receipt.js";
import type {
  PostRecord,
  PostStatus,
  PostSummaryRecord,
  SearchMatchKind,
  SearchMatchRecord,
} from "@/domain/post.js";
import { getSqlite } from "@/store/db.js";

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
  search_match_rank: number | null;
  search_match_excerpt: string | null;
  search_match_title: number;
  search_match_tag: number;
  search_match_author: number;
  search_match_session: number;
  search_match_assigned: number;
  search_match_body: number;
  search_match_reply_author: number;
  search_match_reply_session: number;
  search_match_reply_body: number;
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
    createdAt: row.created_at,
  };
}

function mapPostSummary(row: PostSummaryRow): PostSummaryRecord {
  const searchMatch = mapSearchMatch(row);
  return {
    ...(mapPost(row) as PostRecord),
    lastActivityAt: row.last_activity_at,
    replyCount: row.reply_count,
    reactionCount: row.reaction_count,
    lastReplyExcerpt: row.last_reply_body,
    lastReplyActor: row.last_reply_actor,
    searchMatch,
  };
}

function mapSearchMatch(row: PostSummaryRow): SearchMatchRecord | null {
  if (row.search_match_rank == null || !row.search_match_excerpt) {
    return null;
  }

  const kinds = [
    row.search_match_title ? "title" : null,
    row.search_match_tag ? "tag" : null,
    row.search_match_author ? "author" : null,
    row.search_match_session ? "session" : null,
    row.search_match_assigned ? "assigned" : null,
    row.search_match_body ? "body" : null,
    row.search_match_reply_author ? "reply-author" : null,
    row.search_match_reply_session ? "reply-session" : null,
    row.search_match_reply_body ? "reply-body" : null,
  ].filter(Boolean) as SearchMatchKind[];

  if (kinds.length === 0) {
    return null;
  }

  return {
    kind: kinds[0],
    kinds,
    excerpt: row.search_match_excerpt,
    rank: row.search_match_rank,
  };
}

function buildSearchSummaryColumns(text?: string): { sql: string; params: Array<string | number> } {
  const query = text?.trim();
  if (!query) {
    return {
      sql: `NULL AS search_match_rank,
        NULL AS search_match_excerpt,
        0 AS search_match_title,
        0 AS search_match_tag,
        0 AS search_match_author,
        0 AS search_match_session,
        0 AS search_match_assigned,
        0 AS search_match_body,
        0 AS search_match_reply_author,
        0 AS search_match_reply_session,
        0 AS search_match_reply_body`,
      params: [],
    };
  }

  const params: string[] = [];
  const bind = () => {
    params.push(query);
    return "?";
  };

  const titleMatchSql = () => `instr(lower(posts.title), lower(${bind()})) > 0`;
  const tagMatchSql = () => `EXISTS (
    SELECT 1 FROM json_each(posts.tags) st
    WHERE instr(lower(COALESCE(st.value, '')), lower(${bind()})) > 0
  )`;
  const authorMatchSql = () => `instr(lower(COALESCE(posts.actor, '')), lower(${bind()})) > 0`;
  const sessionMatchSql = () => `instr(lower(COALESCE(posts.session, '')), lower(${bind()})) > 0`;
  const assignedMatchSql = () =>
    `instr(lower(COALESCE(posts.assigned_to, '')), lower(${bind()})) > 0`;
  const bodyMatchSql = () => `instr(lower(posts.body), lower(${bind()})) > 0`;
  const replyAuthorMatchSql = () => `EXISTS (
    SELECT 1 FROM replies sra
    WHERE sra.post_id = posts.id
      AND instr(lower(COALESCE(sra.actor, '')), lower(${bind()})) > 0
  )`;
  const replyBodyMatchSql = () => `EXISTS (
    SELECT 1 FROM replies srb
    WHERE srb.post_id = posts.id
      AND instr(lower(COALESCE(srb.body, '')), lower(${bind()})) > 0
  )`;
  const replySessionMatchSql = () => `EXISTS (
    SELECT 1 FROM replies srs
    WHERE srs.post_id = posts.id
      AND instr(lower(COALESCE(srs.session, '')), lower(${bind()})) > 0
  )`;
  const firstTagMatchSql = () => `(SELECT value FROM json_each(posts.tags) st
    WHERE instr(lower(COALESCE(st.value, '')), lower(${bind()})) > 0
    LIMIT 1)`;
  const firstReplyAuthorMatchSql = () => `(SELECT actor FROM replies sra
    WHERE sra.post_id = posts.id
      AND instr(lower(COALESCE(sra.actor, '')), lower(${bind()})) > 0
    ORDER BY created_at DESC
    LIMIT 1)`;
  const firstReplyBodyMatchSql = () => `(SELECT body FROM replies srb
    WHERE srb.post_id = posts.id
      AND instr(lower(COALESCE(srb.body, '')), lower(${bind()})) > 0
    ORDER BY created_at DESC
    LIMIT 1)`;
  const firstReplySessionMatchSql = () => `(SELECT session FROM replies srs
    WHERE srs.post_id = posts.id
      AND instr(lower(COALESCE(srs.session, '')), lower(${bind()})) > 0
    ORDER BY created_at DESC
    LIMIT 1)`;

  return {
    sql: `CASE
        WHEN ${titleMatchSql()} THEN 1
        WHEN ${tagMatchSql()} THEN 2
        WHEN ${authorMatchSql()} THEN 3
        WHEN ${sessionMatchSql()} THEN 4
        WHEN ${assignedMatchSql()} THEN 5
        WHEN ${bodyMatchSql()} THEN 6
        WHEN ${replyAuthorMatchSql()} THEN 7
        WHEN ${replySessionMatchSql()} THEN 8
        WHEN ${replyBodyMatchSql()} THEN 9
        ELSE NULL
      END AS search_match_rank,
      CASE
        WHEN ${titleMatchSql()} THEN posts.title
        WHEN ${tagMatchSql()} THEN ${firstTagMatchSql()}
        WHEN ${authorMatchSql()} THEN posts.actor
        WHEN ${sessionMatchSql()} THEN posts.session
        WHEN ${assignedMatchSql()} THEN posts.assigned_to
        WHEN ${bodyMatchSql()} THEN posts.body
        WHEN ${replyAuthorMatchSql()} THEN ${firstReplyAuthorMatchSql()}
        WHEN ${replySessionMatchSql()} THEN ${firstReplySessionMatchSql()}
        WHEN ${replyBodyMatchSql()} THEN ${firstReplyBodyMatchSql()}
        ELSE NULL
      END AS search_match_excerpt,
      CASE WHEN ${titleMatchSql()} THEN 1 ELSE 0 END AS search_match_title,
      CASE WHEN ${tagMatchSql()} THEN 1 ELSE 0 END AS search_match_tag,
      CASE WHEN ${authorMatchSql()} THEN 1 ELSE 0 END AS search_match_author,
      CASE WHEN ${sessionMatchSql()} THEN 1 ELSE 0 END AS search_match_session,
      CASE WHEN ${assignedMatchSql()} THEN 1 ELSE 0 END AS search_match_assigned,
      CASE WHEN ${bodyMatchSql()} THEN 1 ELSE 0 END AS search_match_body,
      CASE WHEN ${replyAuthorMatchSql()} THEN 1 ELSE 0 END AS search_match_reply_author,
      CASE WHEN ${replySessionMatchSql()} THEN 1 ELSE 0 END AS search_match_reply_session,
      CASE WHEN ${replyBodyMatchSql()} THEN 1 ELSE 0 END AS search_match_reply_body`,
    params,
  };
}

function buildListQuery(
  filters: PostFilters,
  selectClause: string
): { sql: string; params: Array<string | number> } {
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
      OR posts.actor LIKE ?
      OR posts.session LIKE ?
      OR posts.assigned_to LIKE ?
      OR EXISTS (
        SELECT 1 FROM json_each(posts.tags) jt
        WHERE jt.value LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM replies rt
        WHERE rt.post_id = posts.id
        AND (rt.body LIKE ? OR rt.actor LIKE ? OR rt.session LIKE ?)
      )
    )`);
    params.push(query, query, query, query, query, query, query, query, query);
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
  if (filters.replySession) {
    where.push("EXISTS (SELECT 1 FROM replies rs WHERE rs.post_id = posts.id AND rs.session = ?)");
    params.push(filters.replySession);
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
    where.push(
      "EXISTS (SELECT 1 FROM replies wr WHERE wr.post_id = posts.id AND wr.actor IS NOT NULL AND wr.actor != ?)"
    );
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
  const exactTags = [...new Set([...(filters.tag ? [filters.tag] : []), ...(filters.tags ?? [])])];
  for (const tag of exactTags) {
    where.push("posts.tags LIKE ?");
    params.push(`%${JSON.stringify(tag)}%`);
  }
  const partialTags = [...new Set(filters.tagContains ?? [])];
  for (const tagFragment of partialTags) {
    where.push(`EXISTS (
      SELECT 1 FROM json_each(posts.tags) pt
      WHERE instr(lower(COALESCE(pt.value, '')), lower(?)) > 0
    )`);
    params.push(tagFragment);
  }
  for (const clause of filters.structuredClauses ?? []) {
    const compiled = buildStructuredClause(clause);
    if (!compiled) {
      continue;
    }
    where.push(compiled.sql);
    params.push(...compiled.params);
  }

  return {
    sql: [
      selectClause,
      joins.join(" "),
      where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
      "ORDER BY posts.pinned DESC, posts.created_at DESC",
      filters.limit ? `LIMIT ${Number(filters.limit)}` : filters.offset ? "LIMIT -1" : "",
      filters.offset ? `OFFSET ${Number(filters.offset)}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    params,
  };
}

function buildStructuredClause(
  clause: StructuredFilterClause
): { sql: string; params: Array<string | number> } | null {
  const normalizedValue = clause.value.trim();
  if (!normalizedValue) {
    return null;
  }

  const exactParams = [normalizedValue];
  const containsParams = [normalizedValue];

  const exactFieldSql = (fieldSql: string) => {
    switch (clause.operator) {
      case "=":
        return { sql: `${fieldSql} = ?`, params: exactParams };
      case "!=":
        return { sql: `COALESCE(${fieldSql}, '') != ?`, params: exactParams };
      case "~=":
        return {
          sql: `instr(lower(COALESCE(${fieldSql}, '')), lower(?)) > 0`,
          params: containsParams,
        };
      case "!~=":
        return {
          sql: `instr(lower(COALESCE(${fieldSql}, '')), lower(?)) = 0`,
          params: containsParams,
        };
    }
  };

  const exactExistsSql = (subquery: string) => {
    switch (clause.operator) {
      case "=":
      case "~=":
        return { sql: `EXISTS (${subquery})`, params: containsParams };
      case "!=":
      case "!~=":
        return { sql: `NOT EXISTS (${subquery})`, params: containsParams };
    }
  };

  switch (clause.field) {
    case "actor":
      return exactFieldSql("posts.actor");
    case "session":
      return exactFieldSql("posts.session");
    case "assigned":
      return exactFieldSql("posts.assigned_to");
    case "channel":
      return exactFieldSql("posts.channel");
    case "status":
      return clause.operator === "~=" || clause.operator === "!~="
        ? null
        : exactFieldSql("posts.status");
    case "type":
      return clause.operator === "~=" || clause.operator === "!~="
        ? null
        : exactFieldSql("posts.type");
    case "severity":
      return clause.operator === "~=" || clause.operator === "!~="
        ? null
        : exactFieldSql("posts.severity");
    case "tag":
      return exactExistsSql(`SELECT 1 FROM json_each(posts.tags) jt
        WHERE ${
          clause.operator === "=" || clause.operator === "!="
            ? "COALESCE(jt.value, '') = ?"
            : "instr(lower(COALESCE(jt.value, '')), lower(?)) > 0"
        }`);
    case "reply-actor":
      return exactExistsSql(`SELECT 1 FROM replies ra
        WHERE ra.post_id = posts.id AND ${
          clause.operator === "=" || clause.operator === "!="
            ? "COALESCE(ra.actor, '') = ?"
            : "instr(lower(COALESCE(ra.actor, '')), lower(?)) > 0"
        }`);
    case "reply-session":
      return exactExistsSql(`SELECT 1 FROM replies rs
        WHERE rs.post_id = posts.id AND ${
          clause.operator === "=" || clause.operator === "!="
            ? "COALESCE(rs.session, '') = ?"
            : "instr(lower(COALESCE(rs.session, '')), lower(?)) > 0"
        }`);
  }
}

export class PostRepository
  implements PostRepositoryPort, MetadataRepositoryPort, ReadReceiptRepositoryPort
{
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
        blocking: post.blocking ? 1 : 0,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: posts.idempotency_key")
      ) {
        throw new AgentForumError("Idempotency key already exists.", 4);
      }
      throw error;
    }

    return post;
  }

  findById(id: string): PostRecord | null {
    const row = this.db().prepare("SELECT * FROM posts WHERE id = ?").get(id) as
      | PostRow
      | undefined;
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
    const rows = this.db()
      .prepare(sql)
      .all(...params) as PostRow[];
    return rows.map((row) => mapPost(row) as PostRecord);
  }

  listSummaries(filters: PostFilters = {}): PostSummaryRecord[] {
    if (filters.afterId && !this.findById(filters.afterId)) {
      throw new AgentForumError(`Post not found: ${filters.afterId}`, 2);
    }
    const searchColumns = buildSearchSummaryColumns(filters.text);
    const { sql, params } = buildListQuery(
      filters,
      `SELECT DISTINCT
        posts.*,
        ${LAST_ACTIVITY_SQL} AS last_activity_at,
        (SELECT COUNT(*) FROM replies WHERE post_id = posts.id) AS reply_count,
        (SELECT COUNT(*) FROM reactions WHERE post_id = posts.id) AS reaction_count,
        (SELECT actor FROM replies WHERE post_id = posts.id ORDER BY created_at DESC LIMIT 1) AS last_reply_actor,
        (SELECT body FROM replies WHERE post_id = posts.id ORDER BY created_at DESC LIMIT 1) AS last_reply_body,
        ${searchColumns.sql}
      FROM posts`
    );
    const rows = this.db()
      .prepare(sql)
      .all(...searchColumns.params, ...params) as PostSummaryRow[];
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
    this.db()
      .prepare("UPDATE posts SET pinned = ? WHERE id = ?")
      .run(pinned ? 1 : 0, id);
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
      .prepare(
        `
        INSERT INTO meta (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `
      )
      .run(key, value);
  }

  getMeta(key: string): string | null {
    const row = this.db().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  allMeta(): Record<string, string> {
    const rows = this.db().prepare("SELECT key, value FROM meta").all() as Array<{
      key: string;
      value: string;
    }>;
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
    const updateStatement = this.db().prepare(
      "UPDATE read_receipts SET last_read_at = ? WHERE id = ?"
    );

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
    const rows = this.db()
      .prepare("SELECT * FROM read_receipts ORDER BY created_at ASC")
      .all() as ReadReceiptRow[];
    return rows.map((row) => ({
      id: row.id,
      session: row.session,
      postId: row.post_id,
      createdAt: row.created_at,
      lastReadAt: row.last_read_at,
    }));
  }
}
