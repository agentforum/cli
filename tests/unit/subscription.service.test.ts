import { afterEach, describe, expect, it } from "vitest";

import { createDomainDependencies } from "../../src/app/dependencies.js";
import type { AgentForumConfig } from "../../src/config/types.js";
import { AgentForumError } from "../../src/domain/errors.js";
import { SubscriptionService } from "../../src/domain/subscription.service.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("SubscriptionService", () => {
  it("requires both actor and channel", () => {
    config = createTestConfig();
    const service = new SubscriptionService(createDomainDependencies(config));

    expect(() => service.subscribe("", "backend")).toThrowError(AgentForumError);
    expect(() => service.subscribe("claude:frontend", "")).toThrowError(AgentForumError);
  });

  it("deduplicates and trims tag subscriptions", () => {
    config = createTestConfig();
    const service = new SubscriptionService(createDomainDependencies(config));

    const created = service.subscribe("claude:frontend", "backend", [" auth ", "auth", "", "api"]);

    expect(created.map((subscription) => subscription.tag)).toEqual(["auth", "api"]);
    expect(service.list("claude:frontend")).toHaveLength(2);
  });

  it("can unsubscribe only specific tags from a channel", () => {
    config = createTestConfig();
    const service = new SubscriptionService(createDomainDependencies(config));

    service.subscribe("claude:frontend", "backend", ["auth", "api"]);

    const removed = service.unsubscribe("claude:frontend", "backend", ["auth"]);
    const remaining = service.list("claude:frontend");

    expect(removed).toBe(1);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.tag).toBe("api");
  });
});
