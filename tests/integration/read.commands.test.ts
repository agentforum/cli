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

describe("read command", () => {
  it("shows structured qualifier examples in help output", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["read", "--help"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("/tag~=");
    expect(result.stdout).toContain("--text <text>");
    expect(result.stdout).toContain("/actor= /tag~= /actor!= /tag!~=");
  });

  it("reads a post bundle after replying", async () => {
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
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    await runCli(["reply", "--post", post.id, "--body", "Yes, PATCH remains partial."], workspace);

    const result = await runCli(["read", "--id", post.id, "--json"], workspace);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"replies"');
    expect(result.stdout).toContain("Yes, PATCH remains partial.");
  });

  it("includes typed relations in a post bundle when created through --ref", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const parentCreated = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "initiative",
        "--title",
        "Parent thread",
        "--body",
        "body",
        "--json",
      ],
      workspace
    );
    const parent = JSON.parse(parentCreated.stdout) as { id: string };

    const childCreated = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "risk",
        "--title",
        "Child thread",
        "--body",
        "body",
        "--ref",
        parent.id,
        "--json",
      ],
      workspace
    );
    const child = JSON.parse(childCreated.stdout) as { id: string };

    const result = await runCli(["read", "--id", child.id, "--json"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"relations"');
    expect(result.stdout).toContain('"relationType": "relates-to"');
    expect(result.stdout).toContain(`"toPostId": "${parent.id}"`);
  });

  it("shows reply-targeted reactions when reacting to a reply id", async () => {
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
        "Reward a reply",
        "--body",
        "Which answer should win?",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const replyCreated = await runCli(
      [
        "reply",
        "--post",
        post.id,
        "--body",
        "This is the accepted answer.",
        "--actor",
        "claude:backend",
        "--json",
      ],
      workspace
    );
    const reply = JSON.parse(replyCreated.stdout) as { id: string };

    const reacted = await runCli(
      ["react", "--id", reply.id, "--reaction", "confirmed", "--actor", "gemini:review", "--json"],
      workspace
    );
    expect(reacted.exitCode).toBe(0);
    expect(reacted.stdout).toContain(`"targetType": "reply"`);
    expect(reacted.stdout).toContain(`"targetId": "${reply.id}"`);

    const result = await runCli(["read", "--id", post.id, "--json"], workspace);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"replyReactions"');
    expect(result.stdout).toContain(`"targetId": "${reply.id}"`);
  });

  it("filters posts by channel", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "BE", "--body", "Backend note"],
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
        "FE",
        "--body",
        "Frontend note",
      ],
      workspace
    );

    const result = await runCli(["read", "--channel", "backend", "--json"], workspace);
    expect(result.stdout).toContain('"channel": "backend"');
    expect(result.stdout).not.toContain('"channel": "frontend"');
  });

  it("filters posts by assigned owner", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Assigned",
        "--body",
        "body",
        "--assign",
        "claude:backend",
      ],
      workspace
    );
    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Unassigned",
        "--body",
        "body",
      ],
      workspace
    );

    const result = await runCli(["read", "--assigned-to", "claude:backend", "--json"], workspace);

    expect(result.stdout).toContain("Assigned");
    expect(result.stdout).not.toContain("Unassigned");
  });

  it("filters posts by --text across title and body", async () => {
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
        "oauth details",
        "--body",
        "Spec section 3.2",
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
        "Unrelated",
        "--body",
        "No match here",
      ],
      workspace
    );

    const result = await runCli(["read", "--text", "oauth", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "oauth details")).toBe(true);
    expect(posts.every((p) => p.title !== "Unrelated")).toBe(true);
  });

  it("filters posts by --reply-actor", async () => {
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
        "Has reply",
        "--body",
        "body",
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
        "Reply from specialist",
        "--actor",
        "claude:specialist",
      ],
      workspace
    );
    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "No reply", "--body", "body"],
      workspace
    );

    const result = await runCli(
      ["read", "--reply-actor", "claude:specialist", "--json"],
      workspace
    );

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "Has reply")).toBe(true);
    expect(posts.every((p) => p.title !== "No reply")).toBe(true);
  });

  it("filters posts by --until date", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "Old post", "--body", "body"],
      workspace
    );

    const cutoff = new Date(Date.now() + 86400 * 1000).toISOString();
    const result = await runCli(["read", "--until", cutoff, "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "Old post")).toBe(true);
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
          `Post ${i}`,
          "--body",
          "body",
        ],
        workspace
      );
    }

    const page1 = await runCli(
      ["read", "--channel", "backend", "--page", "1", "--page-size", "2", "--json"],
      workspace
    );
    const page2 = await runCli(
      ["read", "--channel", "backend", "--page", "2", "--page-size", "2", "--json"],
      workspace
    );

    const p1 = JSON.parse(page1.stdout) as Array<{ title: string }>;
    const p2 = JSON.parse(page2.stdout) as Array<{ title: string }>;

    expect(p1).toHaveLength(2);
    expect(p2).toHaveLength(2);
    const titles = [...p1.map((p) => p.title), ...p2.map((p) => p.title)];
    expect(new Set(titles).size).toBe(4);
  });

  it("--text search also matches reply bodies", async () => {
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
        "Blank title",
        "--body",
        "Blank body",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    await runCli(["reply", "--post", post.id, "--body", "xyzzy_unique_term in reply"], workspace);
    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "note",
        "--title",
        "No match",
        "--body",
        "no match here",
      ],
      workspace
    );

    const result = await runCli(["read", "--text", "xyzzy_unique_term", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const posts = JSON.parse(result.stdout) as Array<{ title: string }>;
    expect(posts.some((p) => p.title === "Blank title")).toBe(true);
    expect(posts.every((p) => p.title !== "No match")).toBe(true);
  });

  it("filters posts by reaction type", async () => {
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
        "Needs confirmation",
        "--body",
        "body",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    await runCli(["react", "--id", post.id, "--reaction", "confirmed"], workspace);
    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "No reaction",
        "--body",
        "body",
      ],
      workspace
    );

    const result = await runCli(["read", "--reaction", "confirmed", "--json"], workspace);

    expect(result.stdout).toContain("Needs confirmation");
    expect(result.stdout).not.toContain("No reaction");
  });

  it("filters posts by actor and session together", async () => {
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
        "Owned session",
        "--body",
        "body",
        "--actor",
        "claude:backend",
        "--session",
        "be-run-123",
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
        "Different author",
        "--body",
        "body",
        "--actor",
        "claude:frontend",
        "--session",
        "fe-run-123",
      ],
      workspace
    );

    const result = await runCli(
      ["read", "--actor", "claude:backend", "--session", "be-run-123", "--json"],
      workspace
    );

    expect(result.stdout).toContain("Owned session");
    expect(result.stdout).not.toContain("Different author");
  });

  it("filters posts by type, severity, and pinned status", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "finding",
        "--title",
        "Pinned critical",
        "--body",
        "body",
        "--severity",
        "critical",
        "--pin",
      ],
      workspace
    );
    await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "finding",
        "--title",
        "Unpinned critical",
        "--body",
        "body",
        "--severity",
        "critical",
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
        "Pinned note",
        "--body",
        "body",
        "--pin",
      ],
      workspace
    );

    const result = await runCli(
      ["read", "--type", "finding", "--severity", "critical", "--pinned", "--json"],
      workspace
    );

    expect(result.stdout).toContain("Pinned critical");
    expect(result.stdout).not.toContain("Unpinned critical");
    expect(result.stdout).not.toContain("Pinned note");
  });

  it("filters tags exactly instead of by substring", async () => {
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
        "Pay thread",
        "--body",
        "body",
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
        "Payments thread",
        "--body",
        "body",
        "--tag",
        "payments",
      ],
      workspace
    );

    const result = await runCli(["read", "--tag", "pay", "--json"], workspace);

    expect(result.stdout).toContain("Pay thread");
    expect(result.stdout).not.toContain("Payments thread");
  });

  it("fails clearly when --after-id does not exist", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["read", "--after-id", "P-missing", "--json"], workspace);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Post not found: P-missing");
  });

  it("filters posts created since a cutoff", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "Older", "--body", "body"],
      workspace
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const cutoff = new Date().toISOString();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await runCli(
      ["post", "--channel", "backend", "--type", "note", "--title", "Newer", "--body", "body"],
      workspace
    );

    const result = await runCli(["read", "--since", cutoff, "--json"], workspace);

    expect(result.stdout).toContain("Newer");
    expect(result.stdout).not.toContain("Older");
  });

  it("rejects invalid read pagination values", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["read", "--page", "0"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("--page must be a positive integer.");
  });
});
