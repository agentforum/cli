import { writeFileSync } from "node:fs";

import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "@/domain/types.js";
import { runCli } from "../cli-test-helpers.js";
import { cleanupTestConfig, createTestConfig, writeWorkspaceConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("backup/config commands", () => {
  it("initializes config and shows it", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const init = await runCli(["config", "init", "--local", "--overwrite"], workspace);
    const show = await runCli(["config", "show"], workspace);

    expect(init.exitCode).toBe(0);
    expect(show.stdout).toContain("dbPath");
  });

  it("creates and lists sqlite backups", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "x", "--body", "y"],
      workspace
    );
    const created = await runCli(["backup", "create", "--json"], workspace);
    const listed = await runCli(["backup", "list", "--json"], workspace);

    expect(created.stdout).toContain(".sqlite");
    expect(listed.stdout).toContain(".sqlite");
  });

  it("restores the live database from a sqlite backup", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "note",
        "--title",
        "Before restore",
        "--body",
        "body",
      ],
      workspace
    );
    const createdBackup = await runCli(["backup", "create", "--json"], workspace);
    const backup = JSON.parse(createdBackup.stdout) as { id: string };

    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "note",
        "--title",
        "After backup",
        "--body",
        "body",
      ],
      workspace
    );
    const beforeRestore = await runCli(["read", "--json"], workspace);
    expect(beforeRestore.stdout).toContain("Before restore");
    expect(beforeRestore.stdout).toContain("After backup");

    const restored = await runCli(["backup", "restore", "--file", backup.id, "--json"], workspace);
    const afterRestore = await runCli(["read", "--json"], workspace);

    expect(restored.exitCode).toBe(0);
    expect(afterRestore.stdout).toContain("Before restore");
    expect(afterRestore.stdout).not.toContain("After backup");
  });

  it("restores integration cursors and operation log from a sqlite backup", async () => {
    config = {
      ...createTestConfig(),
      integrations: {
        enabled: ["openclaw"],
        plugins: {
          openclaw: {
            actorMappings: {
              backend: "claude:backend",
            },
          },
        },
      },
    };
    const workspace = writeWorkspaceConfig(config);

    const ingestInput = JSON.stringify({
      action: "create-post",
      operationKey: "restore-op-001",
      identity: { agentId: "backend", sessionKey: "restore-run" },
      payload: {
        channel: "backend",
        type: "finding",
        title: "Restored op log",
        body: "body",
      },
    });
    await runCli(["integrations", "ingest", "openclaw", "--input", ingestInput], workspace);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Restore cursor",
        "--body",
        "body",
        "--actor",
        "claude:triage",
        "--session",
        "restore-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    await runCli(["assign", "--id", post.id, "--actor", "claude:backend"], workspace);
    await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "restore-run" }),
        "--consumer",
        "restore-consumer",
        "--limit",
        "1",
      ],
      workspace
    );

    const createdBackup = await runCli(["backup", "create", "--json"], workspace);
    const backup = JSON.parse(createdBackup.stdout) as { id: string };

    await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "create-post",
          operationKey: "restore-op-002",
          identity: { agentId: "backend", sessionKey: "restore-run" },
          payload: {
            channel: "backend",
            type: "note",
            title: "After backup",
            body: "body",
          },
        }),
      ],
      workspace
    );

    const restored = await runCli(["backup", "restore", "--file", backup.id, "--json"], workspace);
    const replayed = await runCli(
      ["integrations", "ingest", "openclaw", "--input", ingestInput],
      workspace
    );
    const resumedBridge = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "restore-run" }),
        "--consumer",
        "restore-consumer",
      ],
      workspace
    );
    const resumedBridgeAgain = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "restore-run" }),
        "--consumer",
        "restore-consumer",
      ],
      workspace
    );

    expect(restored.exitCode).toBe(0);
    expect(JSON.parse(replayed.stdout)).toMatchObject({
      operationKey: "restore-op-001",
      replayed: true,
    });
    expect(resumedBridge.exitCode).toBe(0);
    expect(resumedBridge.stdout).toContain('"eventType":"post.assigned"');
    expect(resumedBridgeAgain.exitCode).toBe(0);
    expect(resumedBridgeAgain.stdout.trim()).toBe("");
  });

  it("imports JSON as a non-destructive merge and reports created, skipped, and conflicts", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "Existing", "--body", "body"],
      workspace
    );

    const exported = await runCli(
      ["backup", "export", "--output", `${config.backupDir}/forum.json`, "--json"],
      workspace
    );
    const payload = JSON.parse(exported.stdout) as {
      posts: Array<{
        id: string;
        channel: string;
        type: string;
        title: string;
        body: string;
        data: Record<string, unknown> | null;
        severity: "critical" | "warning" | "info" | null;
        status: "open" | "answered" | "needs-clarification" | "wont-answer" | "stale";
        actor: string | null;
        session: string | null;
        tags: string[];
        pinned: boolean;
        refId: string | null;
        blocking: boolean;
        assignedTo: string | null;
        idempotencyKey: string | null;
        createdAt: string;
      }>;
      relations: Array<{
        id: string;
        fromPostId: string;
        toPostId: string;
        relationType: string;
        actor: string | null;
        session: string | null;
        createdAt: string;
      }>;
      auditEvents: Array<{
        id: string;
        eventType: string;
        postId: string | null;
        replyId: string | null;
        relationId: string | null;
        reactionId: string | null;
        actor: string | null;
        session: string | null;
        payload: Record<string, unknown>;
        createdAt: string;
      }>;
      replies: unknown[];
      reactions: unknown[];
      subscriptions: unknown[];
      readReceipts: unknown[];
      meta: Record<string, string>;
      exportedAt: string;
      version: string;
    };
    const existingPost = payload.posts[0];

    payload.posts.push({
      ...existingPost,
      id: "P-imported-cli",
      title: "Imported",
      body: "from backup merge",
      actor: "claude:backend",
      session: "cli-merge-001",
      idempotencyKey: "cli-merge-001",
    });
    payload.relations.push({
      id: "RL-imported-cli",
      fromPostId: "P-imported-cli",
      toPostId: existingPost.id,
      relationType: "blocks",
      actor: "claude:backend",
      session: "cli-merge-001",
      createdAt: "2026-03-18T12:10:00.000Z",
    });
    payload.auditEvents.push({
      id: "E-imported-cli",
      eventType: "post.created",
      postId: "P-imported-cli",
      replyId: null,
      relationId: null,
      reactionId: null,
      actor: "claude:backend",
      session: "cli-merge-001",
      payload: { title: "Imported" },
      createdAt: "2026-03-18T12:11:00.000Z",
    });
    payload.meta.writeCount = "999";

    writeFileSync(
      `${config.backupDir}/forum.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );

    const imported = await runCli(
      ["backup", "import", "--file", `${config.backupDir}/forum.json`, "--json"],
      workspace
    );
    const report = JSON.parse(imported.stdout) as {
      created: { posts: number; relations: number; auditEvents: number };
      skipped: { posts: number };
      conflicts: { total: number };
    };
    const afterImport = await runCli(["read", "--json"], workspace);
    const importedBundle = await runCli(["read", "--id", "P-imported-cli", "--json"], workspace);

    expect(imported.exitCode).toBe(0);
    expect(report.created.posts).toBe(1);
    expect(report.created.relations).toBe(1);
    expect(report.created.auditEvents).toBe(1);
    expect(report.skipped.posts).toBe(1);
    expect(report.conflicts.total).toBe(1);
    expect(afterImport.stdout).toContain("Existing");
    expect(afterImport.stdout).toContain("Imported");
    expect(importedBundle.stdout).toContain('"relationType": "blocks"');
  });
});
