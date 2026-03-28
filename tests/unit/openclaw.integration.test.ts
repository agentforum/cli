import { afterEach, describe, expect, it } from "vitest";

import { createIntegrationApi } from "@/integrations/api.js";
import { openclawIntegration } from "@/integrations/openclaw/index.js";
import type { AgentForumConfig } from "@/domain/types.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

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
      openclaw: {
        actorMappings: {
          backend: "claude:backend",
        },
        defaultSourceRepo: "billing-api",
        defaultSourceWorkspace: "billing-api",
      },
    },
  };
}

describe("openclaw integration", () => {
  it("resolves identity using actor mappings and runtime defaults", () => {
    config = createOpenClawConfig();
    const api = createIntegrationApi(config);

    const identity = openclawIntegration.resolveIdentity?.(
      {
        agentId: "backend",
        sessionKey: "run-001",
      },
      api,
      config
    );

    expect(identity).toMatchObject({
      actor: "claude:backend",
      session: "run-001",
    });
    expect(identity?.metadata).toMatchObject({
      integration: {
        runtime: "openclaw",
        agentId: "backend",
        sessionKey: "run-001",
        repo: "billing-api",
        workspace: "billing-api",
      },
    });
  });

  it("creates idempotent posts with integration metadata", async () => {
    config = createOpenClawConfig();
    const api = createIntegrationApi(config);

    const first = await openclawIntegration.ingest?.(
      {
        action: "create-post",
        identity: {
          agentId: "backend",
          sessionKey: "run-002",
          repo: "checkout-api",
          workspace: "checkout-api",
        },
        payload: {
          channel: "backend",
          type: "finding",
          title: "Retry risk",
          body: "Retries are unbounded.",
          idempotencyKey: "retry-risk-1",
        },
      },
      api,
      config
    );
    const second = await openclawIntegration.ingest?.(
      {
        action: "create-post",
        identity: {
          agentId: "backend",
          sessionKey: "run-002",
          repo: "checkout-api",
          workspace: "checkout-api",
        },
        payload: {
          channel: "backend",
          type: "finding",
          title: "Retry risk",
          body: "Retries are unbounded.",
          idempotencyKey: "retry-risk-1",
        },
      },
      api,
      config
    );

    expect(first?.duplicated).toBe(false);
    expect(second?.duplicated).toBe(true);
    expect((first?.entity as { id: string }).id).toBe((second?.entity as { id: string }).id);
    expect(first?.entity).toMatchObject({
      actor: "claude:backend",
      session: "run-002",
      data: {
        integration: {
          runtime: "openclaw",
          repo: "checkout-api",
          workspace: "checkout-api",
        },
      },
    });
  });

  it("tolerates extra optional identity and payload fields for forward-compatible ingest", async () => {
    config = createOpenClawConfig();
    const api = createIntegrationApi(config);

    const result = await openclawIntegration.ingest?.(
      {
        action: "create-post",
        identity: {
          agentId: "backend",
          sessionKey: "run-compat",
          repo: "checkout-api",
          workspace: "checkout-api",
          source: "batch-import",
          featureFlag: "new-ingest-shape",
        },
        payload: {
          channel: "backend",
          type: "finding",
          title: "Forward compatible input",
          body: "Still works.",
          tags: ["compat"],
          futureField: {
            classification: "risk",
          },
        },
      },
      api,
      config
    );

    expect(result).toMatchObject({
      action: "create-post",
      identity: {
        actor: "claude:backend",
        session: "run-compat",
      },
      entity: {
        title: "Forward compatible input",
        tags: ["compat"],
        data: {
          integration: {
            runtime: "openclaw",
            repo: "checkout-api",
            workspace: "checkout-api",
            source: "batch-import",
          },
        },
      },
    });
  });

  it("emits assigned notifications from forum events for the mapped actor", async () => {
    config = createOpenClawConfig();
    const api = createIntegrationApi(config);
    const created = api.createPost({
      channel: "backend",
      type: "question",
      title: "Who owns retries?",
      body: "Need an owner.",
      actor: "claude:triage",
      session: "triage-run",
    });
    api.assignPost(created.post.id, "claude:backend");
    const assignmentEvent = api.listEvents().find((event) => event.eventType === "post.assigned");

    const notifications = await openclawIntegration.onForumEvent?.(
      {
        event: assignmentEvent!,
        identity: {
          agentId: "backend",
          sessionKey: "run-003",
        },
      },
      api,
      config
    );

    expect(notifications).toHaveLength(1);
    expect(notifications?.[0]).toMatchObject({
      kind: "forum-event",
      reason: "assigned",
      targetActor: "claude:backend",
      targetSession: "run-003",
      payload: {
        eventType: "post.assigned",
        postId: created.post.id,
        title: "Who owns retries?",
      },
    });
  });
});
