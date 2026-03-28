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

function createOpenClawConfig(): AgentForumConfig {
  return {
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
}

describe("integration runtime commands", () => {
  it("resolves runtime identity for an enabled integration", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "integrations",
        "resolve",
        "openclaw",
        "--input",
        JSON.stringify({ agentId: "backend", sessionKey: "run-100" }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { actor: string; session: string };
    expect(parsed).toMatchObject({ actor: "claude:backend", session: "run-100" });
  });

  it("accepts extra optional fields in integration resolve input for compatibility", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "integrations",
        "resolve",
        "openclaw",
        "--input",
        JSON.stringify({
          agentId: "backend",
          sessionKey: "run-compat-resolve",
          source: "importer",
          newOptionalField: "future-shape",
        }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      actor: string;
      session: string;
      metadata?: { integration?: Record<string, unknown> };
    };
    expect(parsed).toMatchObject({
      actor: "claude:backend",
      session: "run-compat-resolve",
      metadata: {
        integration: {
          runtime: "openclaw",
          source: "importer",
        },
      },
    });
  });

  it("ingests idempotent create-post actions through openclaw", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);
    const input = JSON.stringify({
      action: "create-post",
      operationKey: "op-create-post-101",
      identity: { agentId: "backend", sessionKey: "run-101" },
      payload: {
        channel: "backend",
        type: "finding",
        title: "Retry risk",
        body: "Retries are unbounded.",
        idempotencyKey: "retry-risk-101",
      },
    });

    const first = await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", input],
      workspace
    );

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(first.stdout)).toMatchObject({ duplicated: false });
    expect(JSON.parse(second.stdout)).toMatchObject({ duplicated: false, replayed: true });
  });

  it("deduplicates handoff ingest actions with a global operation key", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Handoff target",
        "--body",
        "Needs follow-up.",
        "--actor",
        "claude:triage",
        "--session",
        "handoff-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    const input = JSON.stringify({
      action: "handoff",
      operationKey: "handoff-001",
      identity: { agentId: "backend", sessionKey: "run-101b" },
      payload: {
        postId: post.id,
        assignedTo: "claude:backend",
        reason: "Take ownership.",
      },
    });

    const first = await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", input],
      workspace
    );
    const bundle = await runCli(["read", "--id", post.id, "--json"], workspace);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({
      replayed: true,
      operationKey: "handoff-001",
    });
    expect(JSON.parse(bundle.stdout)).toMatchObject({
      totalReplies: 1,
      post: { assignedTo: "claude:backend" },
    });
  });

  it("deduplicates create-reply actions with an operation key", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Reply target",
        "--body",
        "Needs reply.",
        "--actor",
        "claude:triage",
        "--session",
        "reply-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const input = JSON.stringify({
      action: "create-reply",
      operationKey: "reply-001",
      identity: { agentId: "backend", sessionKey: "run-reply" },
      payload: {
        postId: post.id,
        body: "First response.",
      },
    });

    const first = await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", input],
      workspace
    );
    const bundle = await runCli(["read", "--id", post.id, "--json"], workspace);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({ replayed: true, operationKey: "reply-001" });
    expect(JSON.parse(bundle.stdout)).toMatchObject({ totalReplies: 1 });
  });

  it("deduplicates assign-post actions with an operation key", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Assign target",
        "--body",
        "Needs owner.",
        "--actor",
        "claude:triage",
        "--session",
        "assign-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const input = JSON.stringify({
      action: "assign-post",
      operationKey: "assign-001",
      identity: { agentId: "backend", sessionKey: "run-assign" },
      payload: {
        postId: post.id,
        assignedTo: "claude:backend",
      },
    });

    const first = await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", input],
      workspace
    );
    const bundle = await runCli(["read", "--id", post.id, "--json"], workspace);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({ replayed: true, operationKey: "assign-001" });
    expect(JSON.parse(bundle.stdout)).toMatchObject({ post: { assignedTo: "claude:backend" } });
  });

  it("deduplicates resolve-post actions with an operation key", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Resolve target",
        "--body",
        "Needs answer.",
        "--actor",
        "claude:triage",
        "--session",
        "resolve-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const input = JSON.stringify({
      action: "resolve-post",
      operationKey: "resolve-001",
      identity: { agentId: "backend", sessionKey: "run-resolve" },
      payload: {
        postId: post.id,
        status: "stale",
        reason: "No longer needed.",
      },
    });

    const first = await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", input],
      workspace
    );
    const bundle = await runCli(["read", "--id", post.id, "--json"], workspace);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({
      replayed: true,
      operationKey: "resolve-001",
    });
    expect(JSON.parse(bundle.stdout)).toMatchObject({ post: { status: "stale" }, totalReplies: 1 });
  });

  it("deduplicates create-relation actions with an operation key", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const rootCreated = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "initiative",
        "--title",
        "Root",
        "--body",
        "root",
        "--actor",
        "claude:triage",
        "--session",
        "relation-seed",
        "--json",
      ],
      workspace
    );
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
        "child",
        "--actor",
        "claude:triage",
        "--session",
        "relation-seed",
        "--json",
      ],
      workspace
    );
    const root = JSON.parse(rootCreated.stdout) as { id: string };
    const child = JSON.parse(childCreated.stdout) as { id: string };

    const input = JSON.stringify({
      action: "create-relation",
      operationKey: "relation-001",
      identity: { agentId: "backend", sessionKey: "run-relation" },
      payload: {
        fromPostId: child.id,
        toPostId: root.id,
        relationType: "depends-on",
      },
    });

    const first = await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", input],
      workspace
    );
    const bundle = await runCli(["read", "--id", child.id, "--json"], workspace);

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(JSON.parse(second.stdout)).toMatchObject({
      replayed: true,
      operationKey: "relation-001",
    });
    const parsedBundle = JSON.parse(bundle.stdout) as {
      relations: Array<{ relationType: string; toPostId: string }>;
    };
    expect(
      parsedBundle.relations.filter(
        (r) => r.relationType === "depends-on" && r.toPostId === root.id
      )
    ).toHaveLength(1);
  });

  it("allows repeated side effects when no operation key is provided", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "No op-key target",
        "--body",
        "Needs reply.",
        "--actor",
        "claude:triage",
        "--session",
        "noop-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    const input = JSON.stringify({
      action: "create-reply",
      identity: { agentId: "backend", sessionKey: "run-noop-key" },
      payload: {
        postId: post.id,
        body: "Repeated response.",
      },
    });

    await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    await runCli(["integrations", "ingest", "openclaw", "--input", input], workspace);
    const bundle = await runCli(["read", "--id", post.id, "--json"], workspace);

    expect(JSON.parse(bundle.stdout)).toMatchObject({ totalReplies: 2 });
  });

  it("fails when reusing an operation key with a different payload", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const firstInput = JSON.stringify({
      action: "create-post",
      operationKey: "conflict-001",
      identity: { agentId: "backend", sessionKey: "run-conflict" },
      payload: {
        channel: "backend",
        type: "finding",
        title: "First",
        body: "body",
      },
    });
    const secondInput = JSON.stringify({
      action: "create-post",
      operationKey: "conflict-001",
      identity: { agentId: "backend", sessionKey: "run-conflict" },
      payload: {
        channel: "backend",
        type: "finding",
        title: "Second",
        body: "changed",
      },
    });

    const first = await runCli(
      ["integrations", "ingest", "openclaw", "--input", firstInput],
      workspace
    );
    const second = await runCli(
      ["integrations", "ingest", "openclaw", "--input", secondInput],
      workspace
    );

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(3);
    expect(second.stderr).toContain("already used for a different request");
  });

  it("fails when operationKey is empty after trimming", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "create-post",
          operationKey: "   ",
          identity: { agentId: "backend", sessionKey: "run-empty-key" },
          payload: {
            channel: "backend",
            type: "finding",
            title: "Empty key",
            body: "body",
          },
        }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("operationKey must not be empty");
  });

  it("fails reply ingest when required payload fields are missing", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "create-reply",
          identity: { agentId: "backend", sessionKey: "run-bad-reply" },
          payload: {
            body: "Missing post id.",
          },
        }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("payload.postId is required");
  });

  it("fails resolve ingest when the status is invalid", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Invalid resolve",
        "--body",
        "body",
        "--actor",
        "claude:triage",
        "--session",
        "invalid-resolve-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };

    const result = await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "resolve-post",
          identity: { agentId: "backend", sessionKey: "run-invalid-resolve" },
          payload: {
            postId: post.id,
            status: "not-a-real-status",
          },
        }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid status");
  });

  it("bridges assigned events into openclaw notifications", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Need owner",
        "--body",
        "Someone should take this.",
        "--actor",
        "claude:triage",
        "--session",
        "triage-bridge",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    await runCli(["assign", "--id", post.id, "--actor", "claude:backend"], workspace);

    const result = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-102" }),
        "--limit",
        "1",
      ],
      workspace
    );

    expect(result.exitCode).toBe(0);
    const line = result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((item) => JSON.parse(item))[0] as {
      kind: string;
      reason: string;
      targetActor: string;
      payload: { eventType: string; postId: string };
    };
    expect(line).toMatchObject({
      kind: "forum-event",
      reason: "assigned",
      targetActor: "claude:backend",
      payload: {
        eventType: "post.assigned",
        postId: post.id,
      },
    });
  });

  it("persists bridge cursors across runs for the same consumer", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Cursor test",
        "--body",
        "Needs owner.",
        "--actor",
        "claude:triage",
        "--session",
        "bridge-cursor",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    await runCli(["assign", "--id", post.id, "--actor", "claude:backend"], workspace);

    const first = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-102b" }),
        "--consumer",
        "backend-main",
        "--limit",
        "1",
      ],
      workspace
    );
    const second = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-102b" }),
        "--consumer",
        "backend-main",
      ],
      workspace
    );

    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain('"eventType":"post.assigned"');
    expect(second.exitCode).toBe(0);
    expect(second.stdout.trim()).toBe("");
  });

  it("does not overwrite the persisted cursor when replaying manually with --after", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const firstPost = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Replay baseline",
        "--body",
        "body",
        "--actor",
        "claude:triage",
        "--session",
        "replay-seed",
        "--json",
      ],
      workspace
    );
    const baseline = JSON.parse(firstPost.stdout) as { id: string };
    await runCli(["assign", "--id", baseline.id, "--actor", "claude:backend"], workspace);

    const eventStream = await runCli(
      ["events", "--for", "claude:backend", "--session", "replay-seed"],
      workspace
    );
    const firstAssignedEvent = eventStream.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { id: string; eventType: string })
      .find((event) => event.eventType === "post.assigned");
    expect(firstAssignedEvent).toBeTruthy();

    await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-replay-cursor" }),
        "--consumer",
        "replay-consumer",
        "--limit",
        "1",
      ],
      workspace
    );

    const secondPost = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Replay target",
        "--body",
        "body",
        "--actor",
        "claude:triage",
        "--session",
        "replay-seed",
        "--json",
      ],
      workspace
    );
    const target = JSON.parse(secondPost.stdout) as { id: string };
    await runCli(["assign", "--id", target.id, "--actor", "claude:backend"], workspace);

    const replay = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-replay-cursor" }),
        "--consumer",
        "replay-consumer",
        "--after",
        firstAssignedEvent!.id,
        "--limit",
        "1",
      ],
      workspace
    );
    const resumed = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-replay-cursor" }),
        "--consumer",
        "replay-consumer",
        "--limit",
        "1",
      ],
      workspace
    );

    expect(replay.exitCode).toBe(0);
    expect(replay.stdout).toContain('"eventType":"post.assigned"');
    expect(resumed.exitCode).toBe(0);
    expect(resumed.stdout).toContain(`"postId":"${target.id}"`);
  });

  it("keeps bridge consumers isolated from each other", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Consumer isolation",
        "--body",
        "Needs owner.",
        "--actor",
        "claude:triage",
        "--session",
        "consumer-seed",
        "--json",
      ],
      workspace
    );
    const post = JSON.parse(created.stdout) as { id: string };
    await runCli(["assign", "--id", post.id, "--actor", "claude:backend"], workspace);

    const first = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-consumer" }),
        "--consumer",
        "consumer-a",
        "--limit",
        "1",
      ],
      workspace
    );
    const second = await runCli(
      [
        "integrations",
        "bridge",
        "openclaw",
        "--identity",
        JSON.stringify({ agentId: "backend", sessionKey: "run-consumer" }),
        "--consumer",
        "consumer-b",
        "--limit",
        "1",
      ],
      workspace
    );

    expect(first.exitCode).toBe(0);
    expect(second.exitCode).toBe(0);
    expect(first.stdout).toContain('"eventType":"post.assigned"');
    expect(second.stdout).toContain('"eventType":"post.assigned"');
  });

  it("fails ingest when the integration is not enabled", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "create-post",
          identity: { agentId: "backend", sessionKey: "run-103" },
          payload: { channel: "backend", type: "note", title: "x", body: "y" },
        }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("not enabled");
  });

  it("fails relation ingest when the target post does not exist", async () => {
    config = createOpenClawConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "create-relation",
          identity: { agentId: "backend", sessionKey: "run-104" },
          payload: {
            fromPostId: "P_missing_a",
            toPostId: "P_missing_b",
            relationType: "blocks",
          },
        }),
      ],
      workspace
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Post not found");
  });
});
