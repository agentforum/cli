import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "../../src/domain/types.js";
import { runCli } from "../cli-test-helpers.js";
import { cleanupTestConfig, createTestConfig, writeWorkspaceConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("workflow and pipe commands", () => {
  it("assigns a post and shows it in queue", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Owner?",
        "--body",
        "Need owner",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const assigned = await runCli(
      ["assign", "--id", post.id, "--actor", "claude:backend", "--json"],
      workspace
    );
    const queue = await runCli(["queue", "--for", "claude:backend", "--json"], workspace);

    expect(assigned.stdout).toContain('"assignedTo": "claude:backend"');
    expect(queue.stdout).toContain(post.id);
  });

  it("validates assign error paths", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Assign me",
        "--body",
        "body",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const missingActor = await runCli(["assign", "--id", post.id], workspace);
    const conflictingFlags = await runCli(
      ["assign", "--id", post.id, "--actor", "claude:backend", "--clear"],
      workspace
    );

    expect(missingActor.exitCode).toBe(3);
    expect(missingActor.stderr).toContain("Either --actor or --clear is required.");
    expect(conflictingFlags.exitCode).toBe(3);
    expect(conflictingFlags.stderr).toContain("Use either --actor or --clear, not both.");
  });

  it("shows creator-owned threads in waiting after another actor replies", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "frontend",
        "--type",
        "question",
        "--title",
        "API contract",
        "--body",
        "Waiting on backend",
        "--actor",
        "claude:frontend",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(
      ["reply", "--post", post.id, "--body", "Contract updated", "--actor", "claude:backend"],
      workspace
    );

    const waiting = await runCli(["waiting", "--for", "claude:frontend", "--json"], workspace);

    expect(waiting.stdout).toContain(post.id);
  });

  it("combines assigned and subscribed unread posts in inbox", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["subscribe", "--actor", "claude:backend", "--channel", "general"], workspace);

    const assigned = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Assigned",
        "--body",
        "Assigned item",
        "--json",
      ],
      workspace
    );
    const assignedPost = JSON.parse(assigned.stdout) as { id: string };
    await runCli(["assign", "--id", assignedPost.id, "--actor", "claude:backend"], workspace);

    await runCli(
      [
        "post",
        "--channel",
        "general",
        "--type",
        "note",
        "--title",
        "Subscribed",
        "--body",
        "Subscribed item",
      ],
      workspace
    );

    const inbox = await runCli(
      ["inbox", "--for", "claude:backend", "--session", "backend-run-001", "--json"],
      workspace
    );

    expect(inbox.stdout).toContain("Assigned");
    expect(inbox.stdout).toContain("Subscribed");
  });

  it("prints ids and summary in pipe-friendly formats", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Pipe me",
        "--body",
        "Use in fzf",
        "--assign",
        "claude:backend",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const ids = await runCli(["ids", "--assigned-to", "claude:backend"], workspace);
    const summary = await runCli(["summary", "--assigned-to", "claude:backend"], workspace);

    expect(ids.stdout.trim()).toBe(post.id);
    expect(summary.stdout).toContain(post.id);
    expect(summary.stdout).toContain("claude:backend");
    expect(summary.stdout).toContain("\t");
  });

  it("rejects invalid workflow limits", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["queue", "--for", "claude:backend", "--limit", "0"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("--limit must be a positive integer.");
  });
});
