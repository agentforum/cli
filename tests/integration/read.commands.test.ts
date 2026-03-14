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

describe("read command", () => {
  it("reads a post bundle after replying", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      ["post", "--channel", "backend", "--type", "question", "--title", "PATCH?", "--body", "Can PATCH omit phoneNumber?", "--json"],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(["reply", "--post", post.id, "--body", "Yes, PATCH remains partial."], workspace);

    const result = await runCli(["read", "--id", post.id, "--json"], workspace);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("\"replies\"");
    expect(result.stdout).toContain("Yes, PATCH remains partial.");
  });

  it("filters posts by channel", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["post", "--channel", "backend", "--type", "note", "--title", "BE", "--body", "Backend note"], workspace);
    await runCli(["post", "--channel", "frontend", "--type", "note", "--title", "FE", "--body", "Frontend note"], workspace);

    const result = await runCli(["read", "--channel", "backend", "--json"], workspace);
    expect(result.stdout).toContain("\"channel\": \"backend\"");
    expect(result.stdout).not.toContain("\"channel\": \"frontend\"");
  });

  it("filters posts by assigned owner", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["post", "--channel", "backend", "--type", "question", "--title", "Assigned", "--body", "body", "--assign", "claude:backend"],
      workspace
    );
    await runCli(["post", "--channel", "backend", "--type", "question", "--title", "Unassigned", "--body", "body"], workspace);

    const result = await runCli(["read", "--assigned-to", "claude:backend", "--json"], workspace);

    expect(result.stdout).toContain("Assigned");
    expect(result.stdout).not.toContain("Unassigned");
  });
});
