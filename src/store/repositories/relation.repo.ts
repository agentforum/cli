import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import type { RelationRepositoryPort } from "@/domain/ports/repositories.js";
import type { PostRelationRecord } from "@/domain/relation.js";
import { getSqlite } from "@/store/db.js";

interface RelationRow {
  id: string;
  from_post_id: string;
  to_post_id: string;
  relation_type: string;
  actor: string | null;
  session: string | null;
  created_at: string;
}

function mapRelation(row: RelationRow): PostRelationRecord {
  return {
    id: row.id,
    fromPostId: row.from_post_id,
    toPostId: row.to_post_id,
    relationType: row.relation_type,
    actor: row.actor,
    session: row.session,
    createdAt: row.created_at,
  };
}

export class RelationRepository implements RelationRepositoryPort {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  create(relation: PostRelationRecord): PostRelationRecord {
    this.db()
      .prepare(
        `INSERT INTO post_relations (
          id, from_post_id, to_post_id, relation_type, actor, session, created_at
        ) VALUES (
          @id, @fromPostId, @toPostId, @relationType, @actor, @session, @createdAt
        )`
      )
      .run(relation);

    return relation;
  }

  listByPostId(postId: string): PostRelationRecord[] {
    const rows = this.db()
      .prepare(
        `SELECT * FROM post_relations
         WHERE from_post_id = ? OR to_post_id = ?
         ORDER BY created_at DESC`
      )
      .all(postId, postId) as RelationRow[];
    return rows.map(mapRelation);
  }

  all(): PostRelationRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM post_relations ORDER BY created_at ASC")
      .all() as RelationRow[];
    return rows.map(mapRelation);
  }

  deleteByPostId(postId: string): void {
    this.db()
      .prepare("DELETE FROM post_relations WHERE from_post_id = ? OR to_post_id = ?")
      .run(postId, postId);
  }
}
