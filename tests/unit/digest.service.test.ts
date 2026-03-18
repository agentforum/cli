import { afterEach, describe, expect, it } from "vitest";

import { createDomainDependencies } from "../../src/app/dependencies.js";
import { DigestService } from "../../src/domain/digest.service.js";
import { PostService } from "../../src/domain/post.service.js";
import type { AgentForumConfig } from "../../src/config/types.js";
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
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const digestService = new DigestService(dependencies);

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

    expect(digest.pinned.items).toHaveLength(1);
    expect(digest.findings.items).toHaveLength(1);
    expect(digest.questions.items).toHaveLength(1);
    expect(digest.pinned.summary.total).toBe(1);
    expect(digest.findings.summary.shown).toBe(1);
  });

  it("filters digest by channel", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const digestService = new DigestService(dependencies);

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

    expect(digest.findings.items).toHaveLength(1);
    expect(digest.findings.items[0]?.channel).toBe("backend");
  });

  it("limits items per type group with limitPerType", () => {
    config = createTestConfig();
    const dependencies = createDomainDependencies(config);
    const postService = new PostService(dependencies);
    const digestService = new DigestService(dependencies);

    for (let i = 0; i < 5; i++) {
      postService.createPost({
        channel: "general",
        type: "finding",
        title: `Finding ${i}`,
        body: "body",
        severity: "info"
      });
    }

    const digest = digestService.getDigest({ limitPerType: 2 });

    expect(digest.findings.items).toHaveLength(2);
    expect(digest.findings.summary.total).toBe(5);
    expect(digest.findings.summary.shown).toBe(2);
  });
});
