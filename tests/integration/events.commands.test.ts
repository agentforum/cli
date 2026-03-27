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

describe("events command", () => {
  it("emits durable post and reply events as JSONL", async () => {
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
        "Who owns retries?",
        "--body",
        "Need an owner.",
        "--actor",
        "claude:backend",
        "--session",
        "run-001",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(
      [
        "reply",
        "--post",
        post.id,
        "--body",
        "I will take it.",
        "--actor",
        "claude:backend",
        "--session",
        "run-001",
      ],
      workspace
    );

    const result = await runCli(
      ["events", "--for", "claude:backend", "--session", "run-001"],
      workspace
    );

    expect(result.exitCode).toBe(0);
    const lines = result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(
        (line) =>
          JSON.parse(line) as { eventType: string; postId: string | null; replyId: string | null }
      );

    expect(
      lines.some((event) => event.eventType === "post.created" && event.postId === post.id)
    ).toBe(true);
    expect(
      lines.some((event) => event.eventType === "post.replied" && event.postId === post.id)
    ).toBe(true);
  });

  it("emits relation events when using --ref", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const rootCreated = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "initiative",
        "--title",
        "Parent",
        "--body",
        "root thread",
        "--actor",
        "claude:backend",
        "--session",
        "run-002",
        "--json",
      ],
      workspace
    );
    const root = JSON.parse(rootCreated.stdout) as { id: string };

    const childCreated = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "risk",
        "--title",
        "Child",
        "--body",
        "linked thread",
        "--ref",
        root.id,
        "--actor",
        "claude:backend",
        "--session",
        "run-002",
        "--json",
      ],
      workspace
    );
    const child = JSON.parse(childCreated.stdout) as { id: string };

    const events = await runCli(
      ["events", "--for", "claude:backend", "--session", "run-002"],
      workspace
    );
    const lines = events.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(
        (line) =>
          JSON.parse(line) as {
            eventType: string;
            postId: string | null;
            payload: Record<string, unknown>;
          }
      );

    const relationEvent = lines.find(
      (event) => event.eventType === "relation.created" && event.postId === child.id
    );
    expect(relationEvent).toBeTruthy();
    expect(relationEvent?.payload).toMatchObject({
      toPostId: root.id,
      relationType: "relates-to",
    });
  });

  it("fails clearly when event audit is disabled", async () => {
    config = {
      ...createTestConfig(),
      eventAudit: { enabled: false, retentionDays: null },
    };
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      ["events", "--for", "claude:backend", "--session", "run-003"],
      workspace
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Event audit is disabled");
  });

  it("filters events by the requested session", async () => {
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
        "Session A",
        "--body",
        "only for A",
        "--actor",
        "claude:backend",
        "--session",
        "run-A",
      ],
      workspace
    );
    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "note",
        "--title",
        "Session B",
        "--body",
        "only for B",
        "--actor",
        "claude:backend",
        "--session",
        "run-B",
      ],
      workspace
    );

    const result = await runCli(
      ["events", "--for", "claude:backend", "--session", "run-A"],
      workspace
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"session":"run-A"');
    expect(result.stdout).not.toContain('"session":"run-B"');
  });
});
