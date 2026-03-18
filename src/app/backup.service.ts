import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { AgentForumConfig } from "../config/types.js";
import { ensureDirectory } from "../config.js";
import type { BackupExport } from "../domain/backup.js";
import { AgentForumError } from "../domain/errors.js";
import type { BackupServicePort } from "../domain/ports/backup.js";
import type { MetadataRepositoryPort } from "../domain/ports/metadata.js";
import type { PostRepositoryPort, ReactionRepositoryPort, ReplyRepositoryPort, SubscriptionRepositoryPort } from "../domain/ports/repositories.js";
import type { ReadReceiptRepositoryPort } from "../domain/ports/read-receipts.js";
import { getSqlite, resetDb } from "../store/db.js";

interface BackupServiceDependencies {
  posts: PostRepositoryPort;
  replies: ReplyRepositoryPort;
  reactions: ReactionRepositoryPort;
  subscriptions: SubscriptionRepositoryPort;
  readReceipts: ReadReceiptRepositoryPort;
  metadata: MetadataRepositoryPort;
}

export class BackupService implements BackupServicePort {
  constructor(
    private readonly config: AgentForumConfig,
    private readonly dependencies: BackupServiceDependencies
  ) {}

  maybeAutoBackup(): string | null {
    if (!this.config.autoBackup) {
      return null;
    }

    const currentCount = Number(this.dependencies.metadata.getMeta("writeCount") ?? "0") + 1;
    this.dependencies.metadata.setMeta("writeCount", String(currentCount));

    if (currentCount % this.config.autoBackupInterval !== 0) {
      return null;
    }

    return this.createBackup();
  }

  createBackup(outputPath?: string): string {
    ensureDirectory(this.config.backupDir);
    getSqlite(this.config);

    const filename = outputPath ?? join(this.config.backupDir, `${new Date().toISOString().replaceAll(":", "-")}.sqlite`);
    copyFileSync(this.config.dbPath, filename);
    this.dependencies.metadata.setMeta("lastBackupPath", filename);
    this.dependencies.metadata.setMeta("lastBackupAt", new Date().toISOString());
    return filename;
  }

  listBackups(): string[] {
    if (!existsSync(this.config.backupDir)) {
      return [];
    }

    return readdirSync(this.config.backupDir)
      .filter((name) => name.endsWith(".sqlite") || name.endsWith(".json"))
      .map((name) => join(this.config.backupDir, name))
      .sort();
  }

  exportToJson(outputPath: string): BackupExport {
    ensureDirectory(dirname(outputPath));
    const payload: BackupExport = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      posts: this.dependencies.posts.all(),
      replies: this.dependencies.replies.all(),
      reactions: this.dependencies.reactions.all(),
      subscriptions: this.dependencies.subscriptions.all(),
      readReceipts: this.dependencies.readReceipts.allReadReceipts(),
      meta: this.dependencies.metadata.allMeta()
    };

    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return payload;
  }

  importFromJson(filePath: string): BackupExport {
    if (!existsSync(filePath)) {
      throw new AgentForumError(`Backup file not found: ${filePath}`, 2);
    }

    let payload: BackupExport;
    try {
      payload = JSON.parse(readFileSync(filePath, "utf8")) as BackupExport;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Malformed backup JSON.";
      throw new AgentForumError(`Invalid backup JSON: ${message}`, 3);
    }

    this.dependencies.posts.clearAll();

    for (const post of payload.posts) {
      this.dependencies.posts.create(post);
    }
    for (const reply of payload.replies) {
      this.dependencies.replies.create(reply);
    }
    for (const reaction of payload.reactions) {
      this.dependencies.reactions.create(reaction);
    }
    this.dependencies.subscriptions.createMany(payload.subscriptions ?? []);
    for (const receipt of payload.readReceipts ?? []) {
      this.dependencies.readReceipts.markRead(receipt.session, [receipt.postId], receipt.lastReadAt ?? receipt.createdAt);
    }
    for (const [key, value] of Object.entries(payload.meta ?? {})) {
      this.dependencies.metadata.setMeta(key, value);
    }

    return payload;
  }

  restoreFromSqlite(filePath: string): string {
    if (!existsSync(filePath)) {
      throw new AgentForumError(`Backup file not found: ${filePath}`, 2);
    }

    resetDb();
    ensureDirectory(this.config.backupDir);
    copyFileSync(filePath, this.config.dbPath);
    return basename(filePath);
  }
}
