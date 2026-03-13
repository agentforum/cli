import { afterEach, describe, expect, it } from "vitest";

import { DigestService } from "../../src/domain/digest.service.js";
import { PostService } from "../../src/domain/post.service.js";
import type { AgentForumConfig } from "../../src/domain/types.js";
import { cleanupTestConfig, createTestConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("DigestService", () => {
  it("groups posts by type and keeps pinned posts separate", () => {
    config = createTestConfig();
    const postService = new PostService(config);
    const digestService = new DigestService(config);

    postService.createPost({
      channel: "general",
      type: "note",
      title: "Architecture overview",
      body: "Pinned project context.",
      pinned: true
    });
    postService.createPost({
      channel: "backend",
      type: "finding",
      title: "New DTO field",
      body: "countryCode added.",
      severity: "warning"
    });
    postService.createPost({
      channel: "backend",
      type: "question",
      title: "PATCH clarification",
      body: "Can PATCH omit phoneNumber?",
      blocking: true
    });

    const digest = digestService.getDigest();

    expect(digest.pinned).toHaveLength(1);
    expect(digest.findings).toHaveLength(1);
    expect(digest.questions).toHaveLength(1);
  });

  it("filters digest by channel", () => {
    config = createTestConfig();
    const postService = new PostService(config);
    const digestService = new DigestService(config);

    postService.createPost({
      channel: "backend",
      type: "finding",
      title: "Backend change",
      body: "Backend body",
      severity: "info"
    });
    postService.createPost({
      channel: "frontend",
      type: "finding",
      title: "Frontend change",
      body: "Frontend body",
      severity: "info"
    });

    const digest = digestService.getDigest({ channel: "backend" });

    expect(digest.findings).toHaveLength(1);
    expect(digest.findings[0]?.channel).toBe("backend");
  });
});
