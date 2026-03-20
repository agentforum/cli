import { describe, expect, it } from "vitest";

import { refreshBrowseData, toBrowseListPost } from "@/cli/commands/browse/data.js";
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
    });
    expect(row.replyCount).toBe(2);
    expect(row.lastReplyExcerpt).toContain("Second reply body");
  });

  it("refreshes visible browse data and preserves bundle when available", () => {
    const postService = {
      listPostSummaries: () =>
        POSTS.map((post, index) => ({
          ...post,
          lastActivityAt: index === 0 ? "2026-03-13T12:00:00.000Z" : "2026-03-13T12:01:00.000Z",
          replyCount: 0,
          reactionCount: 0,
          lastReplyExcerpt: null,
          lastReplyActor: null,
        })),
      getPost: () => BUNDLE,
    } as never;

    const result = refreshBrowseData({
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

  it("tracks changed post ids from refreshed summaries", () => {
    const postService = {
      listPostSummaries: () => [
        {
          ...POSTS[0],
          lastActivityAt: "2026-03-13T12:10:00.000Z",
          replyCount: 2,
          reactionCount: 0,
          lastReplyExcerpt: "Latest",
          lastReplyActor: "claude:frontend",
        },
      ],
      getPost: () => BUNDLE,
    } as never;

    const result = refreshBrowseData({
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
        },
      ],
      currentBundle: BUNDLE,
      focusedId: "P-1",
    });

    expect(result.changedPostIds).toEqual(["P-1"]);
  });
});
