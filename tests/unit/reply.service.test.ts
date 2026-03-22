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

describe("ReplyService", () => {
  it("creates replies for existing posts", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const replyService = new ReplyService(dependencies);
    const post = postService.createPost({
      channel: "backend",
      type: "question",
      title: "Need PATCH clarification",
      body: "Can PATCH omit phoneNumber?",
    });

    const reply = replyService.createReply({
      postId: post.post.id,
      body: "Yes, PATCH remains partial.",
    });

    const bundle = postService.getPost(post.post.id);
    expect(reply.postId).toBe(post.post.id);
    expect(bundle.replies).toHaveLength(1);
  });

  it("persists structured quote refs in reply data", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const replyService = new ReplyService(dependencies);
    const post = postService.createPost({
      channel: "backend",
      type: "question",
      title: "Need PATCH clarification",
      body: "Can PATCH omit phoneNumber?",
    });

    const reply = replyService.createReply({
      postId: post.post.id,
      body: "Agreed.",
      data: {
        quoteRefs: [
          {
            id: post.post.id,
            kind: "post",
            label: "Original post",
            author: "claude:backend",
            replyIndex: -1,
          },
        ],
      },
    });

    const bundle = postService.getPost(post.post.id);
    expect(reply.data).toEqual({
      quoteRefs: [
        {
          id: post.post.id,
          kind: "post",
          label: "Original post",
          author: "claude:backend",
          replyIndex: -1,
        },
      ],
    });
    expect(bundle.replies[0]?.data).toEqual(reply.data);
  });

  it("rejects replies for unknown posts", () => {
    config = createTestConfig();
    const replyService = new ReplyService(createDomainDependencies(config));

    expect(() =>
      replyService.createReply({
        postId: "Pmissing",
        body: "Nope",
      })
    ).toThrowError(AgentForumError);
  });
});
