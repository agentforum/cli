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

describe("search command", () => {
  it("shows structured qualifier examples in help output", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["search", "--help"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Search posts by text and structured qualifiers");
    expect(result.stdout).toContain("/tag~=front");
    expect(result.stdout).toContain("/actor!=claude:backend");
    expect(result.stdout).toContain("--tag <tag>");
  });

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

  it("finds posts by post author and reply author", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const authored = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Owned by Claude",
        "--body",
        "Question body",
        "--actor",
        "claude:backend",
        "--json",
      ],
      workspace
    );
    const authoredPost = JSON.parse(authored.stdout) as { id: string };

    const replied = await runCli(
      [
        "post",
        "--channel",
        "frontend",
        "--type",
        "question",
        "--title",
        "Reply actor target",
        "--body",
        "Another question",
        "--json",
      ],
      workspace
    );
    const repliedPost = JSON.parse(replied.stdout) as { id: string };

    await runCli(
      [
        "reply",
        "--post",
        repliedPost.id,
        "--body",
        "Looking into it now",
        "--actor",
        "gemini:frontend",
      ],
      workspace
    );

    const authorResult = await runCli(["search", "claude:backend", "--json"], workspace);
    const authorPosts = JSON.parse(authorResult.stdout) as Array<{ title: string }>;
    expect(authorPosts.some((p) => p.title === "Owned by Claude")).toBe(true);

    const replyActorResult = await runCli(["search", "gemini:frontend", "--json"], workspace);
    const replyActorPosts = JSON.parse(replyActorResult.stdout) as Array<{ title: string }>;
    expect(replyActorPosts.some((p) => p.title === "Reply actor target")).toBe(true);
    expect(replyActorPosts.every((p) => p.title !== "Owned by Claude")).toBe(true);

    expect(authoredPost.id).not.toBe(repliedPost.id);
  });

  it("matches text search case-insensitively for ascii queries", async () => {
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
        "OAuth Token Rotation",
        "--body",
        "Uppercase in title",
      ],
      workspace
    );

    const result = await runCli(["search", "oauth", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "OAuth Token Rotation")).toBe(true);
  });

  it("supports structured free search qualifiers for tags, actor, session, assigned, and reply session", async () => {
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
        "OAuth handoff needed",
        "--body",
        "Need to review the oauth queue",
        "--tag",
        "frontend",
        "--actor",
        "claude:backend",
        "--session",
        "run-042",
        "--assign",
        "gemini:frontend",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(
      ["reply", "--post", post.id, "--body", "Reply context", "--session", "review-007"],
      workspace
    );

    await runCli(
      [
        "post",
        "--channel",
        "frontend",
        "--type",
        "question",
        "--title",
        "OAuth unrelated",
        "--body",
        "Need to review the oauth queue",
        "--tag",
        "ops",
        "--actor",
        "other:actor",
      ],
      workspace
    );

    const actorTagResult = await runCli(
      ["search", "oauth /actor=claude:backend /tag=frontend", "--json"],
      workspace
    );
    expect(actorTagResult.stdout).toContain("OAuth handoff needed");
    expect(actorTagResult.stdout).not.toContain("OAuth unrelated");

    const sessionResult = await runCli(["search", "/session=run-042", "--json"], workspace);
    expect(sessionResult.stdout).toContain("OAuth handoff needed");

    const assignedResult = await runCli(
      ["search", "/assigned=gemini:frontend", "--json"],
      workspace
    );
    expect(assignedResult.stdout).toContain("OAuth handoff needed");

    const replySessionResult = await runCli(
      ["search", "/reply-session=review-007", "--json"],
      workspace
    );
    expect(replySessionResult.stdout).toContain("OAuth handoff needed");

    const partialTagResult = await runCli(["search", "/tag~=front", "--json"], workspace);
    expect(partialTagResult.stdout).toContain("OAuth handoff needed");
    expect(partialTagResult.stdout).not.toContain("OAuth unrelated");

    const negativeActorResult = await runCli(
      ["search", "/actor!=claude:backend", "--json"],
      workspace
    );
    expect(negativeActorResult.stdout).toContain("OAuth unrelated");
    expect(negativeActorResult.stdout).not.toContain("OAuth handoff needed");

    const negativeTagContainsResult = await runCli(["search", "/tag!~=front", "--json"], workspace);
    expect(negativeTagContainsResult.stdout).toContain("OAuth unrelated");
    expect(negativeTagContainsResult.stdout).not.toContain("OAuth handoff needed");
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

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("--page-size must be a positive integer.");
  });

  it("exits with non-zero code when no text argument is given", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["search"], workspace);
    expect(result.exitCode).not.toBe(0);
  });
});
