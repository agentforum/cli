import { describe, expect, it } from "vitest";

import { refreshBrowseData, toBrowseListPost } from "../../src/cli/commands/browse/data.js";
import { BUNDLE, POSTS } from "./browse.fixtures.js";

describe("browse data adapter", () => {
  it("builds browse list posts from post bundles", () => {
    const postService = {
      getPost: () => BUNDLE
    } as never;

    const row = toBrowseListPost(POSTS[0], postService);
    expect(row.replyCount).toBe(2);
    expect(row.lastReplyExcerpt).toContain("Second reply body");
  });

  it("refreshes visible browse data and preserves bundle when available", () => {
    const postService = {
      listPosts: () => POSTS,
      getPost: () => BUNDLE
    } as never;

    const result = refreshBrowseData({
      postService,
      baseFilters: {},
      channelFilter: "__all__",
      sortMode: "activity",
      limit: 30,
      currentIndex: 0,
      currentBundle: BUNDLE,
      focusedId: "P-1"
    });

    expect(result.rawPosts).toHaveLength(2);
    expect(result.bundle?.post.id).toBe("thread-1");
    expect(result.selectedIndex).toBe(1);
  });
});
