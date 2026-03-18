import { writeFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { createDomainDependencies } from "../../src/app/dependencies.js";
import { BackupService } from "../../src/app/backup.service.js";
import { PostService } from "../../src/domain/post.service.js";
import type { AgentForumConfig } from "../../src/config/types.js";
import { AgentForumError } from "../../src/domain/errors.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("BackupService", () => {
  it("exports and imports forum data as JSON", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const backupService = new BackupService(config, dependencies);

    postService.createPost({
      channel: "backend",
      type: "finding",
      title: "Backup me",
      body: "Persistent body",
      severity: "critical"
    });

    const exportPath = `${config.backupDir}/forum-export.json`;
    const exported = backupService.exportToJson(exportPath);

    expect(exported.posts).toHaveLength(1);

    const report = backupService.importFromJson(exportPath);
    const roundTrip = backupService.exportToJson(`${config.backupDir}/forum-export-2.json`);

    expect(report.created.total).toBe(0);
    expect(report.skipped.posts).toBe(1);
    expect(report.conflicts.total).toBe(0);
    expect(roundTrip.posts).toHaveLength(1);
  });

  it("merges backup JSON without deleting current data and reports created, skipped, and conflicts", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const backupService = new BackupService(config, dependencies);

    const existingPost = postService.createPost({
      channel: "backend",
      type: "finding",
      title: "Keep me",
      body: "Current post",
      severity: "warning"
    }).post;
    dependencies.metadata.setMeta("project", "current");

    const importedPost = {
      ...existingPost,
      id: "P-imported",
      title: "Imported post",
      body: "Merged from backup",
      actor: "claude:backend",
      session: "merge-run-001",
      idempotencyKey: "merge-imported-post",
      createdAt: "2026-03-18T12:00:00.000Z"
    };
    const importPath = `${config.backupDir}/merge-import.json`;

    writeFileSync(
      importPath,
      `${JSON.stringify(
        {
          exportedAt: "2026-03-18T12:05:00.000Z",
          version: "1.0",
          posts: [existingPost, importedPost],
          replies: [
            {
              id: "R-imported",
              postId: importedPost.id,
              body: "Imported reply",
              data: null,
              actor: "claude:reviewer",
              session: "merge-run-001",
              createdAt: "2026-03-18T12:01:00.000Z"
            }
          ],
          reactions: [
            {
              id: "RX-missing",
              postId: "P-missing",
              reaction: "confirmed",
              actor: "claude:reviewer",
              session: "merge-run-001",
              createdAt: "2026-03-18T12:02:00.000Z"
            }
          ],
          subscriptions: [],
          readReceipts: [],
          meta: {
            project: "incoming"
          }
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const report = backupService.importFromJson(importPath);
    const snapshot = backupService.exportToJson(`${config.backupDir}/merge-after.json`);

    expect(report.mode).toBe("merge");
    expect(report.created).toMatchObject({
      total: 2,
      posts: 1,
      replies: 1
    });
    expect(report.skipped).toMatchObject({
      total: 1,
      posts: 1
    });
    expect(report.conflicts.total).toBe(2);
    expect(report.conflicts.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: "reactions",
          key: "RX-missing"
        }),
        expect.objectContaining({
          entity: "meta",
          key: "project",
          reason: "different metadata value already exists"
        })
      ])
    );
    expect(snapshot.posts).toHaveLength(2);
    expect(snapshot.posts.map((post) => post.title)).toEqual(expect.arrayContaining(["Keep me", "Imported post"]));
    expect(snapshot.replies).toHaveLength(1);
    expect(snapshot.reactions).toHaveLength(0);
    expect(snapshot.meta.project).toBe("current");
  });

  it("creates sqlite backups and lists them", () => {
    config = createTestConfig();
    const backupService = new BackupService(config, createDomainDependencies(config));

    const path = backupService.createBackup();
    const backups = backupService.listBackups();

    expect(path.endsWith(".sqlite")).toBe(true);
    expect(backups).toContain(path);
  });

  it("rejects malformed backup JSON", () => {
    config = createTestConfig();
    const backupService = new BackupService(config, createDomainDependencies(config));
    const badPath = `${config.backupDir}/bad.json`;

    writeFileSync(badPath, "{broken", "utf8");

    expect(() => backupService.importFromJson(badPath)).toThrowError(AgentForumError);
  });

  it("rejects missing backup JSON files", () => {
    config = createTestConfig();
    const backupService = new BackupService(config, createDomainDependencies(config));

    expect(() => backupService.importFromJson(`${config.backupDir}/missing.json`)).toThrowError(/Backup file not found/);
  });

  it("restores the live sqlite database from a backup snapshot", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const backupService = new BackupService(config, dependencies);

    postService.createPost({
      channel: "backend",
      type: "note",
      title: "Before restore",
      body: "keep me"
    });
    const backupPath = backupService.createBackup();

    postService.createPost({
      channel: "backend",
      type: "note",
      title: "After backup",
      body: "drop me"
    });
    expect(backupService.exportToJson(`${config.backupDir}/before-restore.json`).posts).toHaveLength(2);

    const restored = backupService.restoreFromSqlite(backupPath);
    const snapshot = backupService.exportToJson(`${config.backupDir}/after-restore.json`);

    expect(restored.endsWith(".sqlite")).toBe(true);
    expect(snapshot.posts).toHaveLength(1);
    expect(snapshot.posts[0]?.title).toBe("Before restore");
  });

  it("creates an auto-backup after the configured number of writes", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const backupService = new BackupService(config, dependencies);

    postService.createPost({
      channel: "backend",
      type: "note",
      title: "first",
      body: "first"
    });
    postService.createPost({
      channel: "backend",
      type: "note",
      title: "second",
      body: "second"
    });

    expect(backupService.listBackups().some((path) => path.endsWith(".sqlite"))).toBe(true);
  });
});
