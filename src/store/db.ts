import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { AgentForumConfig } from "@/config/types.js";
import { ensureDirectory } from "@/config.js";
import { INITIAL_SQL } from "./schema.js";

type DrizzleDb = BetterSQLite3Database<Record<string, never>>;

class DatabaseManager {
  private connection: Database.Database | null = null;
  private drizzleDb: DrizzleDb | null = null;
  private currentPath: string | null = null;

  getConnection(config: AgentForumConfig): Database.Database {
    if (!this.connection || this.currentPath !== config.dbPath) {
      ensureDirectory(dirname(config.dbPath));
      this.connection?.close();
      this.connection = new Database(config.dbPath);
      this.connection.pragma("foreign_keys = ON");
      this.connection.exec(INITIAL_SQL);
      ensureSchema(this.connection);
      this.drizzleDb = drizzle(this.connection);
      this.currentPath = config.dbPath;
    }

    return this.connection;
  }

  getDrizzle(config: AgentForumConfig): DrizzleDb {
    this.getConnection(config);
    return this.drizzleDb as DrizzleDb;
  }

  reset(): void {
    this.connection?.close();
    this.connection = null;
    this.drizzleDb = null;
    this.currentPath = null;
  }
}

export const databaseManager = new DatabaseManager();

export function getSqlite(config: AgentForumConfig): Database.Database {
  return databaseManager.getConnection(config);
}

export function getDb(config: AgentForumConfig): DrizzleDb {
  return databaseManager.getDrizzle(config);
}

export function resetDb(): void {
  databaseManager.reset();
}

function ensureSchema(connection: Database.Database): void {
  const postColumns = connection.prepare("PRAGMA table_info(posts)").all() as Array<{
    name: string;
  }>;
  const postColumnNames = new Set(postColumns.map((column) => column.name));

  if (!postColumnNames.has("assigned_to")) {
    connection.exec("ALTER TABLE posts ADD COLUMN assigned_to TEXT");
  }

  const readReceiptColumns = connection.prepare("PRAGMA table_info(read_receipts)").all() as Array<{
    name: string;
  }>;
  const readReceiptColumnNames = new Set(readReceiptColumns.map((column) => column.name));

  if (!readReceiptColumnNames.has("last_read_at")) {
    connection.exec("ALTER TABLE read_receipts ADD COLUMN last_read_at TEXT");
    connection.exec(
      "UPDATE read_receipts SET last_read_at = created_at WHERE last_read_at IS NULL"
    );
  }

  const reactionColumns = connection.prepare("PRAGMA table_info(reactions)").all() as Array<{
    name: string;
  }>;
  const reactionColumnNames = new Set(reactionColumns.map((column) => column.name));

  if (!reactionColumnNames.has("target_type")) {
    connection.exec("ALTER TABLE reactions ADD COLUMN target_type TEXT");
  }
  if (!reactionColumnNames.has("target_id")) {
    connection.exec("ALTER TABLE reactions ADD COLUMN target_id TEXT");
  }

  connection.exec(`
    UPDATE reactions
    SET target_type = COALESCE(target_type, 'post'),
        target_id = COALESCE(target_id, post_id)
    WHERE target_type IS NULL OR target_id IS NULL
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS post_relations (
      id TEXT PRIMARY KEY,
      from_post_id TEXT NOT NULL,
      to_post_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      actor TEXT,
      session TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (from_post_id) REFERENCES posts(id),
      FOREIGN KEY (to_post_id) REFERENCES posts(id)
    )
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      post_id TEXT,
      reply_id TEXT,
      relation_id TEXT,
      reaction_id TEXT,
      actor TEXT,
      session TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  connection.exec(`
    CREATE TABLE IF NOT EXISTS integration_operations (
      integration_id TEXT NOT NULL,
      operation_key TEXT NOT NULL,
      action TEXT NOT NULL,
      request_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (integration_id, operation_key)
    )
  `);

  const integrationOperationColumns = connection
    .prepare("PRAGMA table_info(integration_operations)")
    .all() as Array<{ name: string }>;
  const integrationOperationColumnNames = new Set(
    integrationOperationColumns.map((column) => column.name)
  );

  if (!integrationOperationColumnNames.has("request_json")) {
    connection.exec(
      "ALTER TABLE integration_operations ADD COLUMN request_json TEXT NOT NULL DEFAULT '{}'"
    );
  }

  connection.exec(`
    CREATE TABLE IF NOT EXISTS integration_cursors (
      integration_id TEXT NOT NULL,
      consumer_key TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (integration_id, consumer_key)
    )
  `);
}
