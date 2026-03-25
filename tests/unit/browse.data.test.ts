import { describe, expect, it, vi } from "vitest";

import {
  buildInitialPostComposerDraft,
  buildInitialSubscriptionComposerDraft,
  refreshBrowseData,
  submitBrowsePost,
  submitBrowseReply,
  submitBrowseSubscription,
  toBrowseListPost,
} from "@/cli/commands/browse/data.js";
import { getVisiblePostComposerFields } from "@/cli/commands/browse/types.js";
import { BUNDLE, POSTS } from "./browse.fixtures.js";

describe("browse data adapter", () => {
  it("builds browse list posts from post summaries", () => {
    const row = toBrowseListPost({
      ...POSTS[0],
      lastActivityAt: "2026-03-13T12:10:00.000Z",
      replyCount: 2,
      reactionCount: 0,
      lastReplyExcerpt: "Second reply body with extra details",
      lastReplyActor: "claude:frontend",
      searchMatch: null,
    });
    expect(row.replyCount).toBe(2);
    expect(row.lastReplyExcerpt).toContain("Second reply body");
  });

  it("preserves search match metadata on browse list posts", () => {
    const row = toBrowseListPost({
      ...POSTS[0],
      lastActivityAt: "2026-03-13T12:10:00.000Z",
      replyCount: 2,
      reactionCount: 0,
      lastReplyExcerpt: "Second reply body with extra details",
      lastReplyActor: "claude:frontend",
      searchMatch: {
        kind: "reply-body",
        kinds: ["reply-body", "author"],
        excerpt: "claude says token rotation is blocked",
        rank: 5,
      },
    });

    expect(row.searchMatch).toEqual({
      kind: "reply-body",
      kinds: ["reply-body", "author"],
      excerpt: "claude says token rotation is blocked",
      rank: 5,
    });
  });

  it("refreshes visible browse data and preserves bundle when available", async () => {
    const postService = {
      listPostSummaries: () =>
        POSTS.map((post, index) => ({
          ...post,
          lastActivityAt: index === 0 ? "2026-03-13T12:00:00.000Z" : "2026-03-13T12:01:00.000Z",
          replyCount: 0,
          reactionCount: 0,
          lastReplyExcerpt: null,
          lastReplyActor: null,
          searchMatch: null,
        })),
      getPost: () => BUNDLE,
    } as never;

    const result = await refreshBrowseData({
      postService,
      baseFilters: {},
      channelFilter: "__all__",
      sortMode: "activity",
      limit: 30,
      currentOffset: 0,
      currentIndex: 0,
      currentRawPosts: [],
      currentBundle: BUNDLE,
      focusedId: "P-1",
    });

    expect(result.rawPosts).toHaveLength(2);
    expect(result.bundle?.post.id).toBe("thread-1");
    expect(result.selectedIndex).toBe(1);
    expect(result.listOffset).toBe(0);
  });

  it("tracks changed post ids from refreshed summaries", async () => {
    const postService = {
      listPostSummaries: () => [
        {
          ...POSTS[0],
          lastActivityAt: "2026-03-13T12:10:00.000Z",
          replyCount: 2,
          reactionCount: 0,
          lastReplyExcerpt: "Latest",
          lastReplyActor: "claude:frontend",
          searchMatch: null,
        },
      ],
      getPost: () => BUNDLE,
    } as never;

    const result = await refreshBrowseData({
      postService,
      baseFilters: {},
      channelFilter: "__all__",
      sortMode: "activity",
      limit: 30,
      currentOffset: 0,
      currentIndex: 0,
      currentRawPosts: [
        {
          ...POSTS[0],
          lastActivityAt: "2026-03-13T12:00:00.000Z",
          replyCount: 1,
          reactionCount: 0,
          lastReplyExcerpt: "Older",
          lastReplyActor: "claude:backend",
          searchMatch: null,
        },
      ],
      currentBundle: BUNDLE,
      focusedId: "P-1",
    });

    expect(result.changedPostIds).toEqual(["P-1"]);
  });

  it("builds a reply body with multiple quoted items in thread order", async () => {
    let capturedBody = "";
    let capturedData: Record<string, unknown> | null = null;
    const replyService = {
      createReply: (input: { body: string; data?: Record<string, unknown> | null }) => {
        capturedBody = input.body;
        capturedData = input.data ?? null;
      },
    } as never;

    await submitBrowseReply(replyService, {
      postId: "thread-1",
      body: "I agree with both points.",
      actor: "claude:backend",
      quotes: [
        {
          id: "R-2",
          kind: "reply",
          label: "Reply 2",
          text: "Second reply body",
          author: "claude:frontend",
          replyIndex: 1,
        },
        {
          id: "thread-1",
          kind: "post",
          label: "Original post",
          text: "Original body",
          author: "claude:backend",
          replyIndex: -1,
        },
      ],
    });

    expect(capturedBody).toContain("> [@claude:backend · original post · ref thread-1]");
    expect(capturedBody).toContain("> [@claude:frontend · reply 2 · ref R-2]");
    expect(capturedBody.indexOf("original post")).toBeLessThan(capturedBody.indexOf("reply 2"));
    expect(capturedBody).toContain("I agree with both points.");
    expect(capturedData).toEqual({
      quoteRefs: [
        {
          id: "thread-1",
          kind: "post",
          label: "Original post",
          author: "claude:backend",
          replyIndex: -1,
        },
        {
          id: "R-2",
          kind: "reply",
          label: "Reply 2",
          author: "claude:frontend",
          replyIndex: 1,
        },
      ],
    });
  });

  it("builds post defaults from current browse context", () => {
    expect(
      buildInitialPostComposerDraft({
        actor: "claude:backend",
        session: "run-042",
        defaultChannel: "backend",
        channel: "frontend",
        refId: "P123",
      })
    ).toMatchObject({
      channel: "frontend",
      actor: "claude:backend",
      session: "run-042",
      refId: "P123",
      type: "finding",
    });
  });

  it("shows only type-relevant composer fields", () => {
    expect(
      getVisiblePostComposerFields({
        ...buildInitialPostComposerDraft({
          actor: "claude:backend",
          defaultChannel: "backend",
        }),
        type: "finding",
      })
    ).toContain("severity");

    expect(
      getVisiblePostComposerFields({
        ...buildInitialPostComposerDraft({
          actor: "claude:backend",
          defaultChannel: "backend",
        }),
        type: "decision",
      })
    ).not.toContain("severity");

    expect(
      getVisiblePostComposerFields({
        ...buildInitialPostComposerDraft({
          actor: "claude:backend",
          defaultChannel: "backend",
        }),
        type: "question",
      })
    ).toContain("blocking");
  });

  it("normalizes post draft values before submit", async () => {
    const createPost = vi.fn().mockResolvedValue({ post: { id: "P123" } });

    await expect(
      submitBrowsePost({ createPost } as never, {
        channel: " backend ",
        type: "question",
        title: "  Need review ",
        body: "body",
        severity: "",
        data: '{"foo":"bar"}',
        tags: " api, ui ",
        actor: " claude:backend ",
        session: " run-042 ",
        refId: " P111 ",
        blocking: "yes",
        pinned: "true",
        assignedTo: " claude:frontend ",
        idempotencyKey: " retry-1 ",
      })
    ).resolves.toEqual({ id: "P123" });

    expect(createPost).toHaveBeenCalledWith({
      channel: "backend",
      type: "question",
      title: "Need review",
      body: "body",
      severity: null,
      data: { foo: "bar" },
      tags: ["api", "ui"],
      actor: "claude:backend",
      session: "run-042",
      refId: "P111",
      blocking: true,
      pinned: true,
      assignedTo: "claude:frontend",
      idempotencyKey: "retry-1",
    });
  });

  it("rejects invalid post draft values", async () => {
    const createPost = vi.fn();

    await expect(
      submitBrowsePost({ createPost } as never, {
        channel: "backend",
        type: "oops",
        title: "Broken",
        body: "body",
        severity: "",
        data: "",
        tags: "",
        actor: "",
        session: "",
        refId: "",
        blocking: "maybe",
        pinned: "",
        assignedTo: "",
        idempotencyKey: "",
      })
    ).rejects.toThrow("Invalid type");
  });

  it("submits subscribe and unsubscribe drafts", async () => {
    const subscribe = vi.fn().mockResolvedValue(undefined);
    const unsubscribe = vi.fn().mockResolvedValue(2);

    await expect(
      submitBrowseSubscription(
        { subscribe, unsubscribe } as never,
        buildInitialSubscriptionComposerDraft({
          actor: "claude:frontend",
          defaultChannel: "backend",
          channel: "frontend",
        })
      )
    ).resolves.toEqual({});

    expect(subscribe).toHaveBeenCalledWith("claude:frontend", "frontend", []);

    await expect(
      submitBrowseSubscription({ subscribe, unsubscribe } as never, {
        mode: "unsubscribe",
        actor: "claude:frontend",
        channel: "frontend",
        tags: "api, ui",
      })
    ).resolves.toEqual({ removed: 2 });

    expect(unsubscribe).toHaveBeenCalledWith("claude:frontend", "frontend", ["api", "ui"]);
  });
});
