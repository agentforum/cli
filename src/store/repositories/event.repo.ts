import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";
import {
  type AuditEventFilters,
  type AuditEventRecord,
  isAuditEventPayload,
} from "@/domain/event.js";
import type { AuditEventRepositoryPort } from "@/domain/ports/repositories.js";
import { getSqlite } from "@/store/db.js";

interface EventRow {
  id: string;
  event_type: AuditEventRecord["eventType"];
  post_id: string | null;
  reply_id: string | null;
  relation_id: string | null;
  reaction_id: string | null;
  actor: string | null;
  session: string | null;
  payload: string;
  created_at: string;
}

function mapEvent(row: EventRow): AuditEventRecord {
  const payload = JSON.parse(row.payload);
  if (!isAuditEventPayload(row.event_type, payload)) {
    throw new AgentForumError(`Invalid payload stored for audit event ${row.id}.`, 1);
  }
  return {
    id: row.id,
    eventType: row.event_type,
    postId: row.post_id,
    replyId: row.reply_id,
    relationId: row.relation_id,
    reactionId: row.reaction_id,
    actor: row.actor,
    session: row.session,
    payload,
    createdAt: row.created_at,
  };
}

export class AuditEventRepository implements AuditEventRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  create(event: AuditEventRecord): AuditEventRecord {
    if (!isAuditEventPayload(event.eventType, event.payload)) {
      throw new AgentForumError(`Invalid payload for audit event ${event.eventType}.`, 1);
    }
    this.db()
      .prepare(
        `INSERT INTO audit_events (
          id, event_type, post_id, reply_id, relation_id, reaction_id, actor, session, payload, created_at
        ) VALUES (
          @id, @eventType, @postId, @replyId, @relationId, @reactionId, @actor, @session, @payload, @createdAt
        )`
      )
      .run({
        ...event,
        payload: JSON.stringify(event.payload),
      });
    return event;
  }

  findById(id: string): AuditEventRecord | null {
    const row = this.db().prepare("SELECT * FROM audit_events WHERE id = ?").get(id) as
      | EventRow
      | undefined;
    return row ? mapEvent(row) : null;
  }

  list(filters: AuditEventFilters = {}): AuditEventRecord[] {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.actor) {
      where.push("actor = ?");
      params.push(filters.actor);
    }
    if (filters.session) {
      where.push("session = ?");
      params.push(filters.session);
    }
    if (filters.afterId) {
      const afterEvent = this.db()
        .prepare("SELECT id, created_at FROM audit_events WHERE id = ?")
        .get(filters.afterId) as { id: string; created_at: string } | undefined;
      if (!afterEvent) {
        throw new AgentForumError(`Audit event not found: ${filters.afterId}`, 2);
      }
      where.push("(created_at > ? OR (created_at = ? AND id > ?))");
      params.push(afterEvent.created_at, afterEvent.created_at, afterEvent.id);
    }

    const sql = [
      "SELECT * FROM audit_events",
      where.length ? `WHERE ${where.join(" AND ")}` : "",
      "ORDER BY created_at ASC, id ASC",
      filters.limit ? `LIMIT ${Number(filters.limit)}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const rows = this.db()
      .prepare(sql)
      .all(...params) as EventRow[];
    return rows.map(mapEvent);
  }

  deleteOlderThan(isoDate: string): number {
    const result = this.db().prepare("DELETE FROM audit_events WHERE created_at < ?").run(isoDate);
    return result.changes;
  }
}
