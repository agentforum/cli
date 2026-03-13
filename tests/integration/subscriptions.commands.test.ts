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

describe("subscriptions and read state", () => {
  it("lets an actor subscribe and read only subscribed unread posts", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["subscribe", "--actor", "claude:frontend", "--channel", "backend", "--tag", "contacts"], workspace);

    await runCli(
      ["post", "--channel", "backend", "--type", "finding", "--title", "Contacts", "--body", "body", "--severity", "info", "--tag", "contacts"],
      workspace
    );
    await runCli(
      ["post", "--channel", "backend", "--type", "finding", "--title", "Payments", "--body", "body", "--severity", "info", "--tag", "payments"],
      workspace
    );

    const unread = await runCli(
      ["read", "--subscribed-for", "claude:frontend", "--unread-for", "fe-run-001", "--json"],
      workspace
    );
    expect(unread.stdout).toContain("Contacts");
    expect(unread.stdout).not.toContain("Payments");
  });

  it("can mark posts as read and then hide them from unread queries", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "One", "--body", "body", "--json"],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(["mark-read", "--session", "reader-2", "--id", post.id], workspace);
    const unread = await runCli(["read", "--unread-for", "reader-2", "--json"], workspace);

    expect(unread.stdout).not.toContain(post.id);
  });

  it("reads only posts after a given id", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const first = await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "First", "--body", "body", "--json"],
      workspace
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    await runCli(["post", "--channel", "backend", "--type", "note", "--title", "Second", "--body", "body"], workspace);

    const firstPost = JSON.parse(first.stdout) as { id: string };
    const after = await runCli(["read", "--after-id", firstPost.id, "--json"], workspace);

    expect(after.stdout).toContain("Second");
    expect(after.stdout).not.toContain("First");
  });

  it("can list subscriptions for an actor", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["subscribe", "--actor", "claude:backend", "--channel", "general"], workspace);
    await runCli(["subscribe", "--actor", "claude:backend", "--channel", "backend", "--tag", "contacts"], workspace);

    const result = await runCli(["subscriptions", "--actor", "claude:backend", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("general");
    expect(result.stdout).toContain("backend");
  });

  it("can unsubscribe an actor from a channel", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["subscribe", "--actor", "claude:frontend", "--channel", "backend"], workspace);
    const unsubResult = await runCli(["unsubscribe", "--actor", "claude:frontend", "--channel", "backend"], workspace);

    expect(unsubResult.exitCode).toBe(0);

    const result = await runCli(["subscriptions", "--actor", "claude:frontend", "--json"], workspace);
    expect(result.stdout.trim()).toBe("[]");
  });
});
