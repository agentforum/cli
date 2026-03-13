import { afterEach, describe, expect, it } from "vitest";

import { PostService } from "../../src/domain/post.service.js";
import type { AgentForumConfig } from "../../src/domain/types.js";
import { AgentForumError } from "../../src/domain/types.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("PostService", () => {
  it("requires severity for findings", () => {
    config = createTestConfig();
    const service = new PostService(config);

    expect(() =>
      service.createPost({
        channel: "backend",
        type: "finding",
        title: "Missing severity",
        body: "This should fail."
      })
    ).toThrowError(AgentForumError);
  });

  it("returns an existing post for a duplicate idempotency key", () => {
    config = createTestConfig();
    const service = new PostService(config);

    const first = service.createPost({
      channel: "backend",
      type: "finding",
      title: "Contact DTO changed",
      body: "phoneNumber is now required.",
      severity: "critical",
      idempotencyKey: "contacts-v1"
    });

    const second = service.createPost({
      channel: "backend",
      type: "finding",
      title: "Contact DTO changed",
      body: "phoneNumber is now required.",
      severity: "critical",
      idempotencyKey: "contacts-v1"
    });

    expect(first.duplicated).toBe(false);
    expect(second.duplicated).toBe(true);
    expect(second.post.id).toBe(first.post.id);
  });

  it("updates post status and adds a reason reply when provided", () => {
    config = createTestConfig();
    const service = new PostService(config);
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      blocking: true
    });

    const updated = service.resolvePost(created.post.id, "answered", "Only required on POST.");
    const bundle = service.getPost(created.post.id);

    expect(updated.status).toBe("answered");
    expect(bundle.replies).toHaveLength(1);
    expect(bundle.replies[0]?.body).toContain("Only required on POST.");
  });

  it("creates reactions for existing posts", () => {
    config = createTestConfig();
    const service = new PostService(config);
    const created = service.createPost({
      channel: "backend",
      type: "finding",
      title: "New error code",
      body: "CONTACT_PHONE_INVALID added.",
      severity: "warning"
    });

    const result = service.createReaction({
      postId: created.post.id,
      reaction: "confirmed",
      actor: "claude:frontend"
    });

    const bundle = service.getPost(created.post.id);
    expect(result.reaction.reaction).toBe("confirmed");
    expect(bundle.reactions).toHaveLength(1);
  });

  it("rejects invalid status transitions", () => {
    config = createTestConfig();
    const service = new PostService(config);
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?"
    });

    service.resolvePost(created.post.id, "wont-answer", "Not applicable");

    expect(() => service.resolvePost(created.post.id, "answered", "Actually yes")).toThrowError(AgentForumError);
  });
});
