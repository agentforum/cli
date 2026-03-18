import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import type { AgentForumConfig } from "../config/types.js";
import { ensureDirectory } from "../config.js";
import type { BackupExport, BackupImportConflict, BackupImportCounts, BackupImportReport } from "../domain/backup.js";
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

  importFromJson(filePath: string): BackupImportReport {
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

    const report: BackupImportReport = {
      mode: "merge",
      file: basename(filePath),
      created: createEmptyImportCounts(),
      skipped: createEmptyImportCounts(),
      conflicts: {
        total: 0,
        items: []
      }
    };

    const transaction = getSqlite(this.config).transaction(() => {
      const postsById = new Map(this.dependencies.posts.all().map((post) => [post.id, post]));
      const postsByIdempotencyKey = new Map(
        this.dependencies.posts
          .all()
          .filter((post) => Boolean(post.idempotencyKey))
          .map((post) => [post.idempotencyKey as string, post])
      );
      const repliesById = new Map(this.dependencies.replies.all().map((reply) => [reply.id, reply]));
      const reactionsById = new Map(this.dependencies.reactions.all().map((reaction) => [reaction.id, reaction]));
      const subscriptions = this.dependencies.subscriptions.all();
      const subscriptionsById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
      const subscriptionsByIdentity = new Map(
        subscriptions.map((subscription) => [subscriptionIdentity(subscription), subscription])
      );
      const readReceipts = this.dependencies.readReceipts.allReadReceipts();
      const readReceiptsById = new Map(readReceipts.map((receipt) => [receipt.id, receipt]));
      const readReceiptsByIdentity = new Map(readReceipts.map((receipt) => [readReceiptIdentity(receipt), receipt]));
      const metadata = new Map(Object.entries(this.dependencies.metadata.allMeta()));

      for (const post of payload.posts) {
        const existingPost = postsById.get(post.id);
        if (existingPost) {
          classifyExistingRecord(report, "posts", post.id, existingPost, post, "different post already exists");
          continue;
        }

        if (post.idempotencyKey) {
          const existingByIdempotencyKey = postsByIdempotencyKey.get(post.idempotencyKey);
          if (existingByIdempotencyKey) {
            addConflict(
              report,
              "posts",
              post.id,
              `post idempotency key already exists on ${existingByIdempotencyKey.id}`
            );
            continue;
          }
        }

        this.dependencies.posts.create(post);
        postsById.set(post.id, post);
        if (post.idempotencyKey) {
          postsByIdempotencyKey.set(post.idempotencyKey, post);
        }
        incrementImportCount(report.created, "posts");
      }

      for (const reply of payload.replies) {
        const existingReply = repliesById.get(reply.id);
        if (existingReply) {
          classifyExistingRecord(report, "replies", reply.id, existingReply, reply, "different reply already exists");
          continue;
        }

        if (!postsById.has(reply.postId)) {
          addConflict(report, "replies", reply.id, `parent post is missing: ${reply.postId}`);
          continue;
        }

        this.dependencies.replies.create(reply);
        repliesById.set(reply.id, reply);
        incrementImportCount(report.created, "replies");
      }

      for (const reaction of payload.reactions) {
        const existingReaction = reactionsById.get(reaction.id);
        if (existingReaction) {
          classifyExistingRecord(
            report,
            "reactions",
            reaction.id,
            existingReaction,
            reaction,
            "different reaction already exists"
          );
          continue;
        }

        if (!postsById.has(reaction.postId)) {
          addConflict(report, "reactions", reaction.id, `parent post is missing: ${reaction.postId}`);
          continue;
        }

        this.dependencies.reactions.create(reaction);
        reactionsById.set(reaction.id, reaction);
        incrementImportCount(report.created, "reactions");
      }

      for (const subscription of payload.subscriptions ?? []) {
        const existingSubscriptionById = subscriptionsById.get(subscription.id);
        if (existingSubscriptionById) {
          classifyExistingRecord(
            report,
            "subscriptions",
            subscription.id,
            existingSubscriptionById,
            subscription,
            "different subscription already exists"
          );
          continue;
        }

        const existingSubscriptionByIdentity = subscriptionsByIdentity.get(subscriptionIdentity(subscription));
        if (existingSubscriptionByIdentity) {
          incrementImportCount(report.skipped, "subscriptions");
          continue;
        }

        this.dependencies.subscriptions.createMany([subscription]);
        subscriptionsById.set(subscription.id, subscription);
        subscriptionsByIdentity.set(subscriptionIdentity(subscription), subscription);
        incrementImportCount(report.created, "subscriptions");
      }

      for (const receipt of payload.readReceipts ?? []) {
        const existingReceiptById = readReceiptsById.get(receipt.id);
        if (existingReceiptById) {
          classifyExistingRecord(
            report,
            "readReceipts",
            receipt.id,
            existingReceiptById,
            receipt,
            "different read receipt already exists"
          );
          continue;
        }

        const existingReceiptByIdentity = readReceiptsByIdentity.get(readReceiptIdentity(receipt));
        if (existingReceiptByIdentity) {
          if (recordsEqual(existingReceiptByIdentity, receipt)) {
            incrementImportCount(report.skipped, "readReceipts");
          } else {
            addConflict(
              report,
              "readReceipts",
              receipt.id,
              `session/post already exists with different timestamps: ${receipt.session}/${receipt.postId}`
            );
          }
          continue;
        }

        if (!postsById.has(receipt.postId)) {
          addConflict(report, "readReceipts", receipt.id, `parent post is missing: ${receipt.postId}`);
          continue;
        }

        insertReadReceipt(this.config, receipt);
        readReceiptsById.set(receipt.id, receipt);
        readReceiptsByIdentity.set(readReceiptIdentity(receipt), receipt);
        incrementImportCount(report.created, "readReceipts");
      }

      for (const [key, value] of Object.entries(payload.meta ?? {})) {
        const existingValue = metadata.get(key);
        if (existingValue === undefined) {
          this.dependencies.metadata.setMeta(key, value);
          metadata.set(key, value);
          incrementImportCount(report.created, "meta");
          continue;
        }

        if (existingValue === value) {
          incrementImportCount(report.skipped, "meta");
          continue;
        }

        addConflict(report, "meta", key, "different metadata value already exists");
      }
    });

    transaction();

    return report;
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

type ImportEntity = keyof Omit<BackupImportCounts, "total">;

function createEmptyImportCounts(): BackupImportCounts {
  return {
    total: 0,
    posts: 0,
    replies: 0,
    reactions: 0,
    subscriptions: 0,
    readReceipts: 0,
    meta: 0
  };
}

function incrementImportCount(counts: BackupImportCounts, entity: ImportEntity): void {
  counts.total += 1;
  counts[entity] += 1;
}

function addConflict(report: BackupImportReport, entity: ImportEntity, key: string, reason: string): void {
  const conflict: BackupImportConflict = { entity, key, reason };
  report.conflicts.total += 1;
  report.conflicts.items.push(conflict);
}

function classifyExistingRecord(
  report: BackupImportReport,
  entity: ImportEntity,
  key: string,
  existing: unknown,
  incoming: unknown,
  conflictReason: string
): void {
  if (recordsEqual(existing, incoming)) {
    incrementImportCount(report.skipped, entity);
    return;
  }

  addConflict(report, entity, key, conflictReason);
}

function subscriptionIdentity(record: { actor: string; channel: string; tag: string | null }): string {
  return `${record.actor}::${record.channel}::${record.tag ?? ""}`;
}

function readReceiptIdentity(record: { session: string; postId: string }): string {
  return `${record.session}::${record.postId}`;
}

function recordsEqual(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function insertReadReceipt(
  config: AgentForumConfig,
  receipt: {
    id: string;
    session: string;
    postId: string;
    createdAt: string;
    lastReadAt: string;
  }
): void {
  getSqlite(config)
    .prepare(`
      INSERT INTO read_receipts (id, session, post_id, created_at, last_read_at)
      VALUES (@id, @session, @postId, @createdAt, @lastReadAt)
    `)
    .run(receipt);
}
