import { writeFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import { BackupService } from "../../src/domain/backup.service.js";
import { PostService } from "../../src/domain/post.service.js";
import type { AgentForumConfig } from "../../src/domain/types.js";
import { AgentForumError } from "../../src/domain/types.js";
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
    const postService = new PostService(config);
    const backupService = new BackupService(config);

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

    backupService.importFromJson(exportPath);
    const roundTrip = backupService.exportToJson(`${config.backupDir}/forum-export-2.json`);

    expect(roundTrip.posts).toHaveLength(1);
  });

  it("creates sqlite backups and lists them", () => {
    config = createTestConfig();
    const backupService = new BackupService(config);

    const path = backupService.createBackup();
    const backups = backupService.listBackups();

    expect(path.endsWith(".sqlite")).toBe(true);
    expect(backups).toContain(path);
  });

  it("rejects malformed backup JSON", () => {
    config = createTestConfig();
    const backupService = new BackupService(config);
    const badPath = `${config.backupDir}/bad.json`;

    writeFileSync(badPath, "{broken", "utf8");

    expect(() => backupService.importFromJson(badPath)).toThrowError(AgentForumError);
  });

  it("creates an auto-backup after the configured number of writes", () => {
    config = createTestConfig();
    const postService = new PostService(config);
    const backupService = new BackupService(config);

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
