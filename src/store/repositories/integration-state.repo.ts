import type Database from "better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import type { IntegrationCursorRecord, IntegrationOperationRecord } from "@/integrations/state.js";
import { getSqlite } from "@/store/db.js";

interface IntegrationOperationRow {
  integration_id: string;
  operation_key: string;
  action: string;
  request_json: string;
  result_json: string;
  created_at: string;
  updated_at: string;
}

interface IntegrationCursorRow {
  integration_id: string;
  consumer_key: string;
  last_event_id: string;
  created_at: string;
  updated_at: string;
}

function mapOperation(row: IntegrationOperationRow): IntegrationOperationRecord {
  return {
    integrationId: row.integration_id,
    operationKey: row.operation_key,
    action: row.action,
    requestJson: row.request_json,
    resultJson: row.result_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCursor(row: IntegrationCursorRow): IntegrationCursorRecord {
  return {
    integrationId: row.integration_id,
    consumerKey: row.consumer_key,
    lastEventId: row.last_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class IntegrationOperationRepository {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  findByKey(integrationId: string, operationKey: string): IntegrationOperationRecord | null {
    const row = this.db()
      .prepare(
        `SELECT * FROM integration_operations
         WHERE integration_id = ? AND operation_key = ?`
      )
      .get(integrationId, operationKey) as IntegrationOperationRow | undefined;
    return row ? mapOperation(row) : null;
  }

  save(record: IntegrationOperationRecord): IntegrationOperationRecord {
    this.db()
      .prepare(
        `INSERT INTO integration_operations (
          integration_id, operation_key, action, request_json, result_json, created_at, updated_at
        ) VALUES (
          @integrationId, @operationKey, @action, @requestJson, @resultJson, @createdAt, @updatedAt
        )
        ON CONFLICT(integration_id, operation_key) DO UPDATE SET
          action = excluded.action,
          request_json = excluded.request_json,
          result_json = excluded.result_json,
          updated_at = excluded.updated_at`
      )
      .run(record);
    return record;
  }

  all(): IntegrationOperationRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM integration_operations ORDER BY created_at ASC")
      .all() as IntegrationOperationRow[];
    return rows.map(mapOperation);
  }

  countForIntegration(integrationId: string): number {
    const row = this.db()
      .prepare("SELECT COUNT(*) as count FROM integration_operations WHERE integration_id = ?")
      .get(integrationId) as { count: number };
    return row.count;
  }
}

export class IntegrationCursorRepository {
  constructor(private readonly config: AgentForumConfig) {}

  private db(): Database.Database {
    return getSqlite(this.config);
  }

  find(integrationId: string, consumerKey: string): IntegrationCursorRecord | null {
    const row = this.db()
      .prepare(
        `SELECT * FROM integration_cursors
         WHERE integration_id = ? AND consumer_key = ?`
      )
      .get(integrationId, consumerKey) as IntegrationCursorRow | undefined;
    return row ? mapCursor(row) : null;
  }

  save(record: IntegrationCursorRecord): IntegrationCursorRecord {
    this.db()
      .prepare(
        `INSERT INTO integration_cursors (
          integration_id, consumer_key, last_event_id, created_at, updated_at
        ) VALUES (
          @integrationId, @consumerKey, @lastEventId, @createdAt, @updatedAt
        )
        ON CONFLICT(integration_id, consumer_key) DO UPDATE SET
          last_event_id = excluded.last_event_id,
          updated_at = excluded.updated_at`
      )
      .run(record);
    return record;
  }

  all(): IntegrationCursorRecord[] {
    const rows = this.db()
      .prepare("SELECT * FROM integration_cursors ORDER BY created_at ASC")
      .all() as IntegrationCursorRow[];
    return rows.map(mapCursor);
  }

  countForIntegration(integrationId: string): number {
    const row = this.db()
      .prepare("SELECT COUNT(*) as count FROM integration_cursors WHERE integration_id = ?")
      .get(integrationId) as { count: number };
    return row.count;
  }
}
