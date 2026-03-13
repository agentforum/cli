import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { AgentForumConfig, BackupExport } from "./types.js";
import type { BackupServicePort } from "./ports/backup.js";
import type {
  PostRepositoryPort,
  ReactionRepositoryPort,
  ReplyRepositoryPort,
  SubscriptionRepositoryPort
} from "./ports/repositories.js";
import { AgentForumError } from "./types.js";
import { ensureDirectory } from "../config.js";
import { getSqlite, resetDb } from "../store/db.js";
import { PostRepository } from "../store/repositories/post.repo.js";
import { ReactionRepository } from "../store/repositories/reaction.repo.js";
import { ReplyRepository } from "../store/repositories/reply.repo.js";
import { SubscriptionRepository } from "../store/repositories/subscription.repo.js";

interface BackupServiceDependencies {
  posts: PostRepositoryPort;
  replies: ReplyRepositoryPort;
  reactions: ReactionRepositoryPort;
  subscriptions: SubscriptionRepositoryPort;
}

export class BackupService implements BackupServicePort {
  private readonly posts: PostRepositoryPort;
  private readonly replies: ReplyRepositoryPort;
  private readonly reactions: ReactionRepositoryPort;
  private readonly subscriptions: SubscriptionRepositoryPort;

  constructor(
    private readonly config: AgentForumConfig,
    dependencies?: Partial<BackupServiceDependencies>
  ) {
    this.posts = dependencies?.posts ?? new PostRepository(config);
    this.replies = dependencies?.replies ?? new ReplyRepository(config);
    this.reactions = dependencies?.reactions ?? new ReactionRepository(config);
    this.subscriptions = dependencies?.subscriptions ?? new SubscriptionRepository(config);
  }

  maybeAutoBackup(): string | null {
    if (!this.config.autoBackup) {
      return null;
    }

    const currentCount = Number(this.posts.getMeta("writeCount") ?? "0") + 1;
    this.posts.setMeta("writeCount", String(currentCount));

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
    this.posts.setMeta("lastBackupPath", filename);
    this.posts.setMeta("lastBackupAt", new Date().toISOString());
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
      posts: this.posts.all(),
      replies: this.replies.all(),
      reactions: this.reactions.all(),
      subscriptions: this.subscriptions.all(),
      readReceipts: this.posts.allReadReceipts(),
      meta: this.posts.allMeta()
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
    this.posts.clearAll();

    for (const post of payload.posts) {
      this.posts.create(post);
    }
    for (const reply of payload.replies) {
      this.replies.create(reply);
    }
    for (const reaction of payload.reactions) {
      this.reactions.create(reaction);
    }
    this.subscriptions.createMany(payload.subscriptions ?? []);
    for (const receipt of payload.readReceipts ?? []) {
      this.posts.markRead(receipt.session, [receipt.postId]);
    }
    for (const [key, value] of Object.entries(payload.meta ?? {})) {
      this.posts.setMeta(key, value);
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
