import { afterEach, describe, expect, it } from "vitest";

import { createDomainDependencies } from "../../src/app/dependencies.js";
import { PostService } from "../../src/domain/post.service.js";
import { ReplyService } from "../../src/domain/reply.service.js";
import type { AgentForumConfig } from "../../src/config/types.js";
import { AgentForumError } from "../../src/domain/errors.js";
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
    const service = new PostService(createDomainDependencies(config));

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
    const service = new PostService(createDomainDependencies(config));

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
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      blocking: true,
      actor: "claude:frontend"
    });

    const updated = service.resolvePost(created.post.id, "answered", "Only required on POST.", "claude:frontend");
    const bundle = service.getPost(created.post.id);

    expect(updated.status).toBe("answered");
    expect(bundle.replies).toHaveLength(1);
    expect(bundle.replies[0]?.body).toContain("Only required on POST.");
  });

  it("creates reactions for existing posts", () => {
    config = createTestConfig();
    const service = new PostService(createDomainDependencies(config));
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
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      actor: "claude:frontend"
    });

    service.resolvePost(created.post.id, "wont-answer", "Not applicable");

    expect(() => service.resolvePost(created.post.id, "answered", "Actually yes", "claude:frontend")).toThrowError(AgentForumError);
  });

  it("allows only the original author to mark a thread as answered", () => {
    config = createTestConfig();
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      actor: "claude:frontend"
    });

    expect(() =>
      service.resolvePost(created.post.id, "answered", "Backend says yes", "claude:backend")
    ).toThrowError(/Only claude:frontend can mark this thread as answered/);
  });

  it("allows participants to mark a thread as needs-clarification", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const replyService = new ReplyService(dependencies);
    const created = postService.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      actor: "claude:frontend"
    });

    const bundleBefore = postService.getPost(created.post.id);
    expect(bundleBefore.replies).toHaveLength(0);

    replyService.createReply({
      postId: created.post.id,
      body: "Please share the failing payload.",
      actor: "claude:backend"
    });

    const updated = postService.resolvePost(
      created.post.id,
      "needs-clarification",
      "Need the exact request body.",
      "claude:backend"
    );

    expect(updated.status).toBe("needs-clarification");
  });

  it("updates assignment for a post", () => {
    config = createTestConfig();
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "Owner?",
      body: "Who is taking this?",
      actor: "claude:frontend"
    });

    const updated = service.assignPost(created.post.id, "claude:backend");

    expect(updated.assignedTo).toBe("claude:backend");
    expect(service.getPost(created.post.id).post.assignedTo).toBe("claude:backend");
  });

  it("deletes a post and cascades replies, reactions, and read receipts", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const replyService = new ReplyService(dependencies);
    const created = postService.createPost({
      channel: "backend",
      type: "question",
      title: "Delete me",
      body: "Temporary thread",
      actor: "claude:frontend"
    });

    replyService.createReply({
      postId: created.post.id,
      body: "Temporary reply",
      actor: "claude:backend"
    });
    postService.createReaction({
      postId: created.post.id,
      reaction: "confirmed",
      actor: "claude:backend"
    });
    postService.markRead("reader-1", [created.post.id]);

    expect(dependencies.replies.listByPostId(created.post.id)).toHaveLength(1);
    expect(dependencies.reactions.listByPostId(created.post.id)).toHaveLength(1);
    expect(dependencies.readReceipts.allReadReceipts()).toHaveLength(1);

    postService.deletePost(created.post.id);

    expect(() => postService.getPost(created.post.id)).toThrowError(/Post not found/);
    expect(dependencies.replies.listByPostId(created.post.id)).toHaveLength(0);
    expect(dependencies.reactions.listByPostId(created.post.id)).toHaveLength(0);
    expect(dependencies.readReceipts.allReadReceipts()).toHaveLength(0);
  });
});
