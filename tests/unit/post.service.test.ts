import { afterEach, describe, expect, it } from "vitest";

import { createDomainDependencies } from "@/app/dependencies.js";
import { PostService } from "@/domain/post.service.js";
import { ReplyService } from "@/domain/reply.service.js";
import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";
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
        body: "This should fail.",
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
      idempotencyKey: "contacts-v1",
    });

    const second = service.createPost({
      channel: "backend",
      type: "finding",
      title: "Contact DTO changed",
      body: "phoneNumber is now required.",
      severity: "critical",
      idempotencyKey: "contacts-v1",
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
      actor: "claude:frontend",
    });

    const updated = service.resolvePost(
      created.post.id,
      "answered",
      "Only required on POST.",
      "claude:frontend"
    );
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
      severity: "warning",
    });

    const result = service.createReaction({
      targetId: created.post.id,
      reaction: "confirmed",
      actor: "claude:frontend",
    });

    const bundle = service.getPost(created.post.id);
    expect(result.reaction.reaction).toBe("confirmed");
    expect(result.reaction.targetType).toBe("post");
    expect(result.reaction.targetId).toBe(created.post.id);
    expect(bundle.reactions).toHaveLength(1);
  });

  it("creates reactions for replies and keeps them scoped to the parent thread", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const replyService = new ReplyService(dependencies);
    const created = postService.createPost({
      channel: "backend",
      type: "question",
      title: "Reward the answer",
      body: "Which fix worked?",
      actor: "claude:frontend",
    });

    const reply = replyService.createReply({
      postId: created.post.id,
      body: "The pagination fix solved it.",
      actor: "claude:backend",
    });

    const result = postService.createReaction({
      targetId: reply.id,
      reaction: "confirmed",
      actor: "gemini:review",
    });

    const bundle = postService.getPost(created.post.id);
    expect(result.reaction.targetType).toBe("reply");
    expect(result.reaction.targetId).toBe(reply.id);
    expect(result.reaction.postId).toBe(created.post.id);
    expect(bundle.reactions).toHaveLength(0);
    expect(bundle.replyReactions).toHaveLength(1);
    expect(bundle.replyReactions?.[0]?.targetId).toBe(reply.id);
  });

  it("accepts configured custom reactions", () => {
    config = {
      ...createTestConfig(),
      reactions: ["confirmed", "approved", "useful"],
    };
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "Can custom reactions be used?",
      body: "Need to support repo-specific acknowledgements.",
    });

    const result = service.createReaction({
      targetId: created.post.id,
      reaction: "approved",
      actor: "claude:backend",
    });

    expect(result.reaction.reaction).toBe("approved");
    expect(service.getPost(created.post.id).reactions[0]?.reaction).toBe("approved");
  });

  it("rejects invalid status transitions", () => {
    config = createTestConfig();
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      actor: "claude:frontend",
    });

    service.resolvePost(created.post.id, "wont-answer", "Not applicable");

    expect(() =>
      service.resolvePost(created.post.id, "answered", "Actually yes", "claude:frontend")
    ).toThrowError(AgentForumError);
  });

  it("allows only the original author to mark a thread as answered", () => {
    config = createTestConfig();
    const service = new PostService(createDomainDependencies(config));
    const created = service.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH behavior",
      body: "Is phoneNumber required?",
      actor: "claude:frontend",
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
      actor: "claude:frontend",
    });

    const bundleBefore = postService.getPost(created.post.id);
    expect(bundleBefore.replies).toHaveLength(0);

    replyService.createReply({
      postId: created.post.id,
      body: "Please share the failing payload.",
      actor: "claude:backend",
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
      actor: "claude:frontend",
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
      actor: "claude:frontend",
    });

    replyService.createReply({
      postId: created.post.id,
      body: "Temporary reply",
      actor: "claude:backend",
    });
    postService.createReaction({
      targetId: created.post.id,
      reaction: "confirmed",
      actor: "claude:backend",
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

  it("returns search match metadata for browse summaries", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const replyService = new ReplyService(dependencies);

    const authored = postService.createPost({
      channel: "backend",
      type: "question",
      title: "Token refresh rollout",
      body: "Original body",
      actor: "claude:backend",
      session: "run-100",
      tags: ["frontend"],
      assignedTo: "gemini:triage",
    });
    const replied = postService.createPost({
      channel: "frontend",
      type: "question",
      title: "Queue behavior",
      body: "Unrelated body",
      actor: "gemini:frontend",
    });

    replyService.createReply({
      postId: replied.post.id,
      body: "Token cache needs rotation",
      actor: "claude:review",
      session: "reply-run-7",
    });

    const titleMatches = postService.listPostSummaries({ text: "token" });
    const titleMatch = titleMatches.find((post) => post.id === authored.post.id);
    expect(titleMatch?.searchMatch).toEqual({
      kind: "title",
      kinds: ["title"],
      excerpt: "Token refresh rollout",
      rank: 1,
    });

    const replyMatches = postService.listPostSummaries({ text: "claude:review" });
    const replyMatch = replyMatches.find((post) => post.id === replied.post.id);
    expect(replyMatch?.searchMatch).toEqual({
      kind: "reply-author",
      kinds: ["reply-author"],
      excerpt: "claude:review",
      rank: 7,
    });

    const tagMatches = postService.listPostSummaries({ text: "front" });
    const tagMatch = tagMatches.find((post) => post.id === authored.post.id);
    expect(tagMatch?.searchMatch).toEqual({
      kind: "tag",
      kinds: ["tag"],
      excerpt: "frontend",
      rank: 2,
    });

    const sessionMatches = postService.listPostSummaries({ text: "run-100" });
    const sessionMatch = sessionMatches.find((post) => post.id === authored.post.id);
    expect(sessionMatch?.searchMatch).toEqual({
      kind: "session",
      kinds: ["session"],
      excerpt: "run-100",
      rank: 4,
    });

    const assignedMatches = postService.listPostSummaries({ text: "gemini:triage" });
    const assignedMatch = assignedMatches.find((post) => post.id === authored.post.id);
    expect(assignedMatch?.searchMatch).toEqual({
      kind: "assigned",
      kinds: ["assigned"],
      excerpt: "gemini:triage",
      rank: 5,
    });

    const replySessionMatches = postService.listPostSummaries({ text: "reply-run-7" });
    const replySessionMatch = replySessionMatches.find((post) => post.id === replied.post.id);
    expect(replySessionMatch?.searchMatch).toEqual({
      kind: "reply-session",
      kinds: ["reply-session"],
      excerpt: "reply-run-7",
      rank: 8,
    });
  });
});
