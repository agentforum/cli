import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import type { AgentForumConfig } from "../config/types.js";
import { ensureDirectory } from "../config.js";
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
  const columns = connection.prepare("PRAGMA table_info(posts)").all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("assigned_to")) {
    connection.exec("ALTER TABLE posts ADD COLUMN assigned_to TEXT");
  }
}
