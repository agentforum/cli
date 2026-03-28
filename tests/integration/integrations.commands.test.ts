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

describe("integrations commands", () => {
  it("lists built-in integrations", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "list"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Array<{ id: string }>;
    expect(parsed.some((item) => item.id === "openclaw")).toBe(true);
  });

  it("shows one integration definition", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "show", "openclaw"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"id": "openclaw"');
    expect(result.stdout).toContain('"displayName": "OpenClaw"');
  });

  it("checks enabled integrations against config", async () => {
    config = {
      ...createTestConfig(),
      integrations: {
        enabled: ["openclaw"],
        openclaw: {
          actorMappings: {
            backend: "claude:backend",
          },
        },
      },
    };
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "check"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Array<{
      id: string;
      ok: boolean;
      warnings: string[];
      errors: string[];
    }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ id: "openclaw", ok: true });
    expect(parsed[0]?.errors).toEqual([]);
  });

  it("accepts the legacy openclaw config shape for compatibility", async () => {
    config = {
      ...createTestConfig(),
      integrations: {
        enabled: ["openclaw"],
        openclaw: {
          actorMappings: {
            backend: "claude:backend",
          },
          bridge: {
            pollIntervalMs: 1500,
          },
        },
      },
    };
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "doctor", "openclaw"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      enabled: boolean;
      bridge: { configured: boolean; pollIntervalMs: number };
    };
    expect(parsed).toMatchObject({
      ok: true,
      enabled: true,
      bridge: {
        configured: true,
        pollIntervalMs: 1500,
      },
    });
  });

  it("reports doctor errors when openclaw requirements are not met", async () => {
    config = {
      ...createTestConfig(),
      eventAudit: { enabled: false, retentionDays: null },
    };
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "doctor", "openclaw"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      enabled: boolean;
      errors: string[];
      bridge: { supported: boolean; configured: boolean; pollIntervalMs: number };
      persistence: { operationLogEntries: number; cursorEntries: number };
    };
    expect(parsed.ok).toBe(false);
    expect(parsed.enabled).toBe(false);
    expect(parsed.errors.some((error) => error.includes("eventAudit.enabled"))).toBe(true);
    expect(parsed.bridge.supported).toBe(true);
    expect(parsed.bridge.pollIntervalMs).toBe(1000);
    expect(parsed.persistence).toMatchObject({ operationLogEntries: 0, cursorEntries: 0 });
  });

  it("reports operational readiness details for an enabled integration", async () => {
    config = {
      ...createTestConfig(),
      integrations: {
        enabled: ["openclaw"],
        plugins: {
          openclaw: {
            actorMappings: {
              backend: "claude:backend",
            },
            bridge: {
              pollIntervalMs: 2500,
            },
          },
        },
      },
    };
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      [
        "integrations",
        "ingest",
        "openclaw",
        "--input",
        JSON.stringify({
          action: "create-post",
          operationKey: "doctor-op-001",
          identity: { agentId: "backend", sessionKey: "doctor-run" },
          payload: {
            channel: "backend",
            type: "finding",
            title: "Doctor sample",
            body: "body",
          },
        }),
      ],
      workspace
    );

    const created = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "question",
        "--title",
        "Doctor bridge",
        "--body",
        "body",
        "--actor",
        "claude:triage",
        "--session",
        "doctor-session",
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
        JSON.stringify({ agentId: "backend", sessionKey: "doctor-run" }),
        "--consumer",
        "doctor-consumer",
        "--limit",
        "1",
      ],
      workspace
    );

    const result = await runCli(["integrations", "doctor", "openclaw"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      ok: boolean;
      enabled: boolean;
      eventAuditEnabled: boolean;
      bridge: { supported: boolean; configured: boolean; pollIntervalMs: number };
      persistence: { operationLogEntries: number; cursorEntries: number };
    };
    expect(parsed).toMatchObject({
      ok: true,
      enabled: true,
      eventAuditEnabled: true,
      bridge: {
        supported: true,
        configured: true,
        pollIntervalMs: 2500,
      },
    });
    expect(parsed.persistence.operationLogEntries).toBeGreaterThanOrEqual(1);
    expect(parsed.persistence.cursorEntries).toBeGreaterThanOrEqual(1);
  });
});
