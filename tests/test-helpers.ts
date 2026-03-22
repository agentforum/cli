import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import type { AgentForumConfig } from "@/domain/types.js";
import { DEFAULT_REACTIONS } from "@/domain/reaction.js";
import { resetDb } from "@/store/db.js";

export function createTestConfig(): AgentForumConfig {
  const root = mkdtempSync(join(tmpdir(), "agentforum-"));
  mkdirSync(join(root, "backups"), { recursive: true });

  return {
    dbPath: join(root, "db.sqlite"),
    backupDir: join(root, "backups"),
    defaultActor: "test:agent",
    defaultChannel: "general",
    autoBackup: true,
    autoBackupInterval: 2,
    dateFormat: "iso",
    reactions: [...DEFAULT_REACTIONS],
  };
}

export function cleanupTestConfig(config: AgentForumConfig): void {
  resetDb();
  rmSync(dirname(config.dbPath), { recursive: true, force: true });
}

export function writeWorkspaceConfig(config: AgentForumConfig): string {
  const root = dirname(config.dbPath);
  writeFileSync(
    join(root, ".afrc"),
    `${JSON.stringify(
      {
        dbPath: "db.sqlite",
        backupDir: "backups",
        defaultActor: config.defaultActor,
        defaultChannel: config.defaultChannel,
        autoBackup: config.autoBackup,
        autoBackupInterval: config.autoBackupInterval,
        dateFormat: config.dateFormat,
        reactions: config.reactions,
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return root;
}

/**
 * Creates a bare temporary directory with no .afrc — simulates a machine
 * where the user has not run `af config init` yet.
 */
export function createBareWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), "agentforum-bare-"));
  mkdirSync(join(root, ".forum"), { recursive: true });
  return root;
}
