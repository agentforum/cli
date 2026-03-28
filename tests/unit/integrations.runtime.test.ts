import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentForumConfig } from "@/domain/types.js";
import type { IntegrationDefinition } from "@/integrations/types.js";
import { createIntegrationApi } from "@/integrations/api.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

const integrationState = vi.hoisted(() => {
  const registry = new Map<string, IntegrationDefinition>();
  const enabled = new Set<string>();
  return { registry, enabled };
});

vi.mock("@/integrations/registry.js", () => ({
  getIntegration: (id: string) => integrationState.registry.get(id),
  isIntegrationEnabled: (id: string) => integrationState.enabled.has(id),
}));

const runtimeModule = await import("@/integrations/runtime.js");

let config: AgentForumConfig | undefined;

afterEach(() => {
  integrationState.registry.clear();
  integrationState.enabled.clear();
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

beforeEach(() => {
  config = createTestConfig();
});

function registerIntegration(definition: IntegrationDefinition, enabled = true) {
  integrationState.registry.set(definition.id, definition);
  if (enabled) {
    integrationState.enabled.add(definition.id);
  }
}

describe("integration runtime", () => {
  it("fails clearly when a required hook is missing", async () => {
    registerIntegration({
      id: "fake-missing",
      displayName: "Missing Hooks",
      version: "1.0.0",
      capabilities: [],
    });

    expect(() => runtimeModule.resolveIntegrationIdentity(config!, "fake-missing", {})).toThrow(
      /does not implement identity resolution/
    );

    await expect(
      runtimeModule.runIntegrationIngest(config!, "fake-missing", { action: "noop" })
    ).rejects.toThrow(/does not implement ingest/);

    await expect(
      runtimeModule.readIntegrationBridgeBatch(config!, "fake-missing", {
        identity: {},
      })
    ).rejects.toThrow(/does not implement event bridging/);
  });

  it("does not advance the cursor when onForumEvent fails and replays the same event later", async () => {
    const api = createIntegrationApi(config!);
    api.createPost({
      channel: "ops",
      type: "note",
      title: "Bridge failure",
      body: "body",
      actor: "claude:ops",
      session: "ops-1",
    });

    let shouldThrow = true;
    registerIntegration({
      id: "fake-bridge",
      displayName: "Fake Bridge",
      version: "1.0.0",
      capabilities: ["event-bridge"],
      onForumEvent: ({ event }) => {
        if (shouldThrow) {
          throw new Error(`boom:${event.id}`);
        }
        return [
          {
            kind: "fake-notification",
            reason: event.eventType,
            targetActor: "claude:ops",
            targetSession: "ops-1",
            payload: { eventId: event.id },
          },
        ];
      },
    });

    await expect(
      runtimeModule.readIntegrationBridgeBatch(config!, "fake-bridge", {
        identity: { actor: "claude:ops", session: "ops-1" },
        consumerKey: "consumer-1",
      })
    ).rejects.toThrow(/boom:/);

    shouldThrow = false;

    const batch = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-bridge", {
      identity: { actor: "claude:ops", session: "ops-1" },
      consumerKey: "consumer-1",
    });

    expect(batch.notifications).toHaveLength(1);
    expect(batch.notifications[0]).toMatchObject({
      kind: "fake-notification",
      payload: { eventId: batch.lastEventId },
    });

    const replay = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-bridge", {
      identity: { actor: "claude:ops", session: "ops-1" },
      consumerKey: "consumer-1",
    });
    expect(replay.notifications).toHaveLength(0);
  });

  it("advances cursors even when events are ignored with no notifications", async () => {
    const api = createIntegrationApi(config!);
    api.createPost({
      channel: "ops",
      type: "note",
      title: "Ignored event",
      body: "body",
      actor: "claude:ops",
      session: "ops-2",
    });

    registerIntegration({
      id: "fake-empty",
      displayName: "Fake Empty",
      version: "1.0.0",
      capabilities: ["event-bridge"],
      onForumEvent: () => [],
    });

    const first = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-empty", {
      identity: { actor: "claude:ops", session: "ops-2" },
      consumerKey: "consumer-empty",
    });
    const second = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-empty", {
      identity: { actor: "claude:ops", session: "ops-2" },
      consumerKey: "consumer-empty",
    });

    expect(first.notifications).toHaveLength(0);
    expect(first.lastEventId).toBeTruthy();
    expect(second.notifications).toHaveLength(0);
    expect(second.lastEventId).toBe(first.lastEventId);
  });

  it("keeps consumer cursors isolated for the same integration", async () => {
    const api = createIntegrationApi(config!);
    api.createPost({
      channel: "ops",
      type: "note",
      title: "Isolation",
      body: "body",
      actor: "claude:ops",
      session: "ops-3",
    });

    registerIntegration({
      id: "fake-consumers",
      displayName: "Fake Consumers",
      version: "1.0.0",
      capabilities: ["event-bridge"],
      onForumEvent: ({ event }) => [
        {
          kind: "fake-notification",
          reason: "seen",
          targetActor: "claude:ops",
          targetSession: "ops-3",
          payload: { eventId: event.id },
        },
      ],
    });

    const first = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-consumers", {
      identity: { actor: "claude:ops", session: "ops-3" },
      consumerKey: "consumer-a",
    });
    const second = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-consumers", {
      identity: { actor: "claude:ops", session: "ops-3" },
      consumerKey: "consumer-b",
    });
    const replayA = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-consumers", {
      identity: { actor: "claude:ops", session: "ops-3" },
      consumerKey: "consumer-a",
    });

    expect(first.notifications).toHaveLength(1);
    expect(second.notifications).toHaveLength(1);
    expect(replayA.notifications).toHaveLength(0);
  });

  it("keeps operation log state isolated across integrations", async () => {
    registerIntegration({
      id: "fake-alpha",
      displayName: "Alpha",
      version: "1.0.0",
      capabilities: ["ingest"],
      ingest: (input) => ({
        action: input.action,
        entity: { plugin: "alpha", action: input.action },
      }),
    });
    registerIntegration({
      id: "fake-beta",
      displayName: "Beta",
      version: "1.0.0",
      capabilities: ["ingest"],
      ingest: (input) => ({
        action: input.action,
        entity: { plugin: "beta", action: input.action },
      }),
    });

    const firstAlpha = await runtimeModule.runIntegrationIngest(config!, "fake-alpha", {
      action: "noop",
      operationKey: "shared-key",
    });
    const secondAlpha = await runtimeModule.runIntegrationIngest(config!, "fake-alpha", {
      action: "noop",
      operationKey: "shared-key",
    });
    const firstBeta = await runtimeModule.runIntegrationIngest(config!, "fake-beta", {
      action: "noop",
      operationKey: "shared-key",
    });

    expect(firstAlpha.replayed).toBe(false);
    expect(secondAlpha.replayed).toBe(true);
    expect(firstBeta.replayed).toBe(false);
    expect(firstBeta.entity).toMatchObject({ plugin: "beta" });
  });

  it("rejects invalid identity objects returned by a plugin", () => {
    registerIntegration({
      id: "fake-bad-identity",
      displayName: "Bad Identity",
      version: "1.0.0",
      capabilities: ["identity-mapping"],
      resolveIdentity: () => ({ actor: 42, session: null }) as never,
    });

    expect(() =>
      runtimeModule.resolveIntegrationIdentity(config!, "fake-bad-identity", {})
    ).toThrow(/invalid identity\.actor/);
  });

  it("rejects invalid ingest results returned by a plugin", async () => {
    registerIntegration({
      id: "fake-bad-ingest",
      displayName: "Bad Ingest",
      version: "1.0.0",
      capabilities: ["ingest"],
      ingest: () => ({ nope: true }) as never,
    });

    await expect(
      runtimeModule.runIntegrationIngest(config!, "fake-bad-ingest", { action: "noop" })
    ).rejects.toThrow(/invalid ingest result/);
  });

  it("rejects invalid bridge notifications returned by a plugin", async () => {
    const api = createIntegrationApi(config!);
    api.createPost({
      channel: "ops",
      type: "note",
      title: "Bad bridge",
      body: "body",
      actor: "claude:ops",
      session: "ops-bad",
    });

    registerIntegration({
      id: "fake-bad-bridge",
      displayName: "Bad Bridge",
      version: "1.0.0",
      capabilities: ["event-bridge"],
      onForumEvent: () => [{ kind: "bad" }] as never,
    });

    await expect(
      runtimeModule.readIntegrationBridgeBatch(config!, "fake-bad-bridge", {
        identity: { actor: "claude:ops", session: "ops-bad" },
      })
    ).rejects.toThrow(/invalid bridge notifications/);
  });

  it("treats --after replay reads as ephemeral and does not persist cursors", async () => {
    const api = createIntegrationApi(config!);
    api.createPost({
      channel: "ops",
      type: "note",
      title: "Replay me",
      body: "body",
      actor: "claude:ops",
      session: "ops-replay",
    });
    const events = api.listEvents();
    const cursorEvent = events[0];
    expect(cursorEvent).toBeTruthy();

    api.createPost({
      channel: "ops",
      type: "note",
      title: "Replay target",
      body: "body",
      actor: "claude:ops",
      session: "ops-replay",
    });

    registerIntegration({
      id: "fake-replay",
      displayName: "Fake Replay",
      version: "1.0.0",
      capabilities: ["event-bridge"],
      onForumEvent: ({ event }) => [
        {
          kind: "fake-notification",
          reason: "seen",
          targetActor: "claude:ops",
          targetSession: "ops-replay",
          payload: { eventId: event.id },
        },
      ],
    });

    const replay = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-replay", {
      identity: { actor: "claude:ops", session: "ops-replay" },
      consumerKey: "consumer-replay",
      afterId: cursorEvent!.id,
    });

    expect(replay.notifications).toHaveLength(1);

    const persisted = await runtimeModule.readIntegrationBridgeBatch(config!, "fake-replay", {
      identity: { actor: "claude:ops", session: "ops-replay" },
      consumerKey: "consumer-replay",
    });
    expect(persisted.notifications.length).toBeGreaterThanOrEqual(2);
  });

  it("fails when reusing an operation key for a different request", async () => {
    registerIntegration({
      id: "fake-opkey",
      displayName: "OpKey",
      version: "1.0.0",
      capabilities: ["ingest"],
      ingest: (input) => ({
        action: input.action,
        entity: { payload: input.payload ?? null },
      }),
    });

    await runtimeModule.runIntegrationIngest(config!, "fake-opkey", {
      action: "noop",
      operationKey: "same-key",
      payload: { value: 1 },
    });

    await expect(
      runtimeModule.runIntegrationIngest(config!, "fake-opkey", {
        action: "noop",
        operationKey: "same-key",
        payload: { value: 2 },
      })
    ).rejects.toThrow(/already used for a different request/);
  });

  it("fails when reusing an operation key for a different action", async () => {
    registerIntegration({
      id: "fake-opkey-action",
      displayName: "OpKey Action",
      version: "1.0.0",
      capabilities: ["ingest"],
      ingest: (input) => ({
        action: input.action,
        entity: { action: input.action },
      }),
    });

    await runtimeModule.runIntegrationIngest(config!, "fake-opkey-action", {
      action: "first",
      operationKey: "same-key",
    });

    await expect(
      runtimeModule.runIntegrationIngest(config!, "fake-opkey-action", {
        action: "second",
        operationKey: "same-key",
      })
    ).rejects.toThrow(/already used for a different request/);
  });

  it("rejects empty operation keys", async () => {
    registerIntegration({
      id: "fake-empty-opkey",
      displayName: "Empty OpKey",
      version: "1.0.0",
      capabilities: ["ingest"],
      ingest: (input) => ({ action: input.action }),
    });

    await expect(
      runtimeModule.runIntegrationIngest(config!, "fake-empty-opkey", {
        action: "noop",
        operationKey: "   ",
      })
    ).rejects.toThrow(/must not be empty/);
  });
});
