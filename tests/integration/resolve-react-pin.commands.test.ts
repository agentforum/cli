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

describe("resolve/react/pin commands", () => {
  it("resolves a question, reacts to it, and pins it", async () => {
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
        "PATCH?",
        "--body",
        "Can PATCH omit phoneNumber?",
        "--actor",
        "claude:frontend",
        "--json"
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const resolved = await runCli(
      [
        "resolve",
        "--id",
        post.id,
        "--status",
        "answered",
        "--reason",
        "Only POST requires it.",
        "--actor",
        "claude:frontend",
        "--json"
      ],
      workspace
    );
    const reacted = await runCli(["react", "--id", post.id, "--reaction", "confirmed", "--json"], workspace);
    const pinned = await runCli(["pin", "--id", post.id, "--json"], workspace);

    expect(resolved.stdout).toContain("\"status\": \"answered\"");
    expect(reacted.stdout).toContain("\"reaction\": \"confirmed\"");
    expect(pinned.stdout).toContain("\"pinned\": true");
  });

  it("can unpin a previously pinned post", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "Pinned once", "--body", "body", "--pin", "--json"],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const result = await runCli(["unpin", "--id", post.id, "--json"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("\"pinned\": false");
  });

  it("rejects stale without reason", async () => {
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
        "PATCH?",
        "--body",
        "Can PATCH omit phoneNumber?",
        "--actor",
        "claude:frontend",
        "--json"
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const result = await runCli(["resolve", "--id", post.id, "--status", "stale"], workspace);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--reason is required");
  });

  it("rejects answered when the resolver is not the original author", async () => {
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
        "PATCH?",
        "--body",
        "Can PATCH omit phoneNumber?",
        "--actor",
        "claude:frontend",
        "--json"
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const result = await runCli(
      ["resolve", "--id", post.id, "--status", "answered", "--reason", "Looks good", "--actor", "claude:backend"],
      workspace
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Only claude:frontend can mark this thread as answered.");
  });
});
