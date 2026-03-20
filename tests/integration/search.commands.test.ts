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

describe("search command", () => {
  it("finds posts whose title matches the query", async () => {
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
        "Token refresh flow",
        "--body",
        "Unrelated body",
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
        "Unrelated post",
        "--body",
        "Unrelated body",
      ],
      workspace
    );

    const result = await runCli(["search", "token", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "Token refresh flow")).toBe(true);
    expect(posts.every((p) => p.title !== "Unrelated post")).toBe(true);
  });

  it("finds posts whose body matches the query", async () => {
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
        "Post A",
        "--body",
        "oauth2 handshake details here",
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
        "Post B",
        "--body",
        "Nothing interesting",
      ],
      workspace
    );

    const result = await runCli(["search", "oauth2", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "Post A")).toBe(true);
    expect(posts.every((p) => p.title !== "Post B")).toBe(true);
  });

  it("finds posts that have a matching reply body", async () => {
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
        "API contract",
        "--body",
        "What is the contract?",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(
      ["reply", "--post", post.id, "--body", "The contract uses JSON:API format"],
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
        "Unrelated",
        "--body",
        "Nothing here",
      ],
      workspace
    );

    const result = await runCli(["search", "JSON:API", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "API contract")).toBe(true);
    expect(posts.every((p) => p.title !== "Unrelated")).toBe(true);
  });

  it("returns empty array when nothing matches", async () => {
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
        "Boring title",
        "--body",
        "Boring body",
      ],
      workspace
    );

    const result = await runCli(["search", "xyzzy_no_match_ever", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as unknown[];
    expect(posts).toHaveLength(0);
  });

  it("combines text search with channel filter", async () => {
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
        "auth token",
        "--body",
        "backend auth",
      ],
      workspace
    );
    await runCli(
      [
        "post",
        "--channel",
        "frontend",
        "--type",
        "note",
        "--title",
        "auth button",
        "--body",
        "frontend auth",
      ],
      workspace
    );

    const result = await runCli(["search", "auth", "--channel", "backend", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ channel: string }>;
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((p) => p.channel === "backend")).toBe(true);
  });

  it("paginates results with --page and --page-size", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    for (let i = 1; i <= 5; i++) {
      await runCli(
        [
          "post",
          "--channel",
          "backend",
          "--type",
          "note",
          "--title",
          `Paginated post ${i}`,
          "--body",
          "shared keyword here",
        ],
        workspace
      );
    }

    const page1 = await runCli(
      ["search", "shared keyword", "--page", "1", "--page-size", "2", "--json"],
      workspace
    );
    const page2 = await runCli(
      ["search", "shared keyword", "--page", "2", "--page-size", "2", "--json"],
      workspace
    );

    const p1Posts = JSON.parse(page1.stdout) as Array<{ title: string }>;
    const p2Posts = JSON.parse(page2.stdout) as Array<{ title: string }>;

    expect(p1Posts).toHaveLength(2);
    expect(p2Posts).toHaveLength(2);
    const allIds = [...p1Posts.map((p) => p.title), ...p2Posts.map((p) => p.title)];
    expect(new Set(allIds).size).toBe(4);
  });

  it("supports exact tag filtering during search", async () => {
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
        "Pay contract",
        "--body",
        "contract details",
        "--tag",
        "pay",
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
        "Payments contract",
        "--body",
        "contract details",
        "--tag",
        "payments",
      ],
      workspace
    );

    const result = await runCli(["search", "contract", "--tag", "pay", "--json"], workspace);

    expect(result.stdout).toContain("Pay contract");
    expect(result.stdout).not.toContain("Payments contract");
  });

  it("rejects invalid pagination values", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["search", "contract", "--page-size", "0"], workspace);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("--page-size must be a positive integer.");
  });

  it("exits with non-zero code when no text argument is given", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["search"], workspace);
    expect(result.exitCode).not.toBe(0);
  });
});
