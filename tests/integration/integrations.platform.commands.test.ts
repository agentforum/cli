import { afterEach, describe, expect, it, vi } from "vitest";

import type { AgentForumConfig } from "@/domain/types.js";
import type { IntegrationDefinition } from "@/integrations/types.js";
import { cleanupTestConfig, createTestConfig, writeWorkspaceConfig } from "../test-helpers.js";

const integrationState = vi.hoisted(() => {
  const registry = new Map<string, IntegrationDefinition>();
  const enabled = new Set<string>();
  return { registry, enabled };
});

vi.mock("@/integrations/registry.js", () => ({
  listIntegrations: () => Array.from(integrationState.registry.values()),
  getIntegration: (id: string) => integrationState.registry.get(id),
  getEnabledIntegrations: () =>
    Array.from(integrationState.registry.values()).filter((integration) =>
      integrationState.enabled.has(integration.id)
    ),
  isIntegrationEnabled: (id: string) => integrationState.enabled.has(id),
}));

const { runCli } = await import("../cli-test-helpers.js");

let config: AgentForumConfig | undefined;

afterEach(() => {
  integrationState.registry.clear();
  integrationState.enabled.clear();
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

function registerIntegration(definition: IntegrationDefinition, enabled = true) {
  integrationState.registry.set(definition.id, definition);
  if (enabled) {
    integrationState.enabled.add(definition.id);
  }
}

describe("integration platform commands", () => {
  it("fails clearly when a plugin returns invalid health data", async () => {
    registerIntegration({
      id: "fake-health",
      displayName: "Fake Health",
      version: "1.0.0",
      capabilities: [],
      validateConfig: () => ({ ok: "yes" }) as never,
    });
    config = {
      ...createTestConfig(),
      integrations: {
        enabled: ["fake-health"],
        plugins: {
          "fake-health": {},
        },
      },
    };
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["integrations", "check"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("invalid health data");
  });

  it("keeps bridge state and doctor persistence isolated across multiple plugins", async () => {
    registerIntegration({
      id: "fake-alpha",
      displayName: "Fake Alpha",
      version: "1.0.0",
      capabilities: ["ingest", "event-bridge"],
      validateConfig: () => ({ ok: true, warnings: [], errors: [] }),
      ingest: (input) => ({ action: input.action, entity: { plugin: "alpha" } }),
      onForumEvent: ({ event }) => [
        {
          kind: "fake-alpha",
          reason: event.eventType,
          targetActor: "claude:test",
          targetSession: "alpha-session",
          payload: { eventId: event.id },
        },
      ],
    });
    registerIntegration({
      id: "fake-beta",
      displayName: "Fake Beta",
      version: "1.0.0",
      capabilities: ["ingest", "event-bridge"],
      validateConfig: () => ({ ok: true, warnings: [], errors: [] }),
      ingest: (input) => ({ action: input.action, entity: { plugin: "beta" } }),
      onForumEvent: ({ event }) => [
        {
          kind: "fake-beta",
          reason: event.eventType,
          targetActor: "claude:test",
          targetSession: "beta-session",
          payload: { eventId: event.id },
        },
      ],
    });
    config = {
      ...createTestConfig(),
      integrations: {
        enabled: ["fake-alpha", "fake-beta"],
        plugins: {
          "fake-alpha": { bridge: { pollIntervalMs: 1111 } },
          "fake-beta": { bridge: { pollIntervalMs: 2222 } },
        },
      },
    };
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      [
        "post",
        "--channel",
        "ops",
        "--type",
        "note",
        "--title",
        "Platform bridge",
        "--body",
        "body",
        "--actor",
        "claude:test",
        "--session",
        "platform-run",
      ],
      workspace
    );

    await runCli(
      [
        "integrations",
        "ingest",
        "fake-alpha",
        "--input",
        JSON.stringify({ action: "alpha-op", operationKey: "alpha-001", payload: { value: 1 } }),
      ],
      workspace
    );
    await runCli(
      [
        "integrations",
        "bridge",
        "fake-alpha",
        "--identity",
        JSON.stringify({ actor: "claude:test", session: "platform-run" }),
        "--consumer",
        "consumer-shared",
        "--limit",
        "1",
      ],
      workspace
    );
    await runCli(
      [
        "integrations",
        "bridge",
        "fake-beta",
        "--identity",
        JSON.stringify({ actor: "claude:test", session: "platform-run" }),
        "--consumer",
        "consumer-shared",
        "--limit",
        "1",
      ],
      workspace
    );

    const alphaDoctor = await runCli(["integrations", "doctor", "fake-alpha"], workspace);
    const betaDoctor = await runCli(["integrations", "doctor", "fake-beta"], workspace);

    expect(alphaDoctor.exitCode).toBe(0);
    expect(betaDoctor.exitCode).toBe(0);
    expect(JSON.parse(alphaDoctor.stdout)).toMatchObject({
      id: "fake-alpha",
      persistence: { operationLogEntries: 1, cursorEntries: 1 },
      bridge: { pollIntervalMs: 1111 },
    });
    expect(JSON.parse(betaDoctor.stdout)).toMatchObject({
      id: "fake-beta",
      persistence: { operationLogEntries: 0, cursorEntries: 1 },
      bridge: { pollIntervalMs: 2222 },
    });
  });
});
