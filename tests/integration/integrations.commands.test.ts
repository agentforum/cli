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

  it("reports doctor errors when openclaw requirements are not met", async () => {
    config = {
      ...createTestConfig(),
      eventAudit: { enabled: false, retentionDays: null },
    };
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "doctor", "openclaw"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { ok: boolean; errors: string[] };
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.some((error) => error.includes("eventAudit.enabled"))).toBe(true);
  });
});
