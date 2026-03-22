import { describe, expect, it } from "vitest";

import {
  ALL_CHANNELS,
  CONVERSATION_FILTER_MODES,
  CONVERSATION_SORT_MODES,
  SORT_MODES,
} from "@/cli/commands/browse/types.js";
import {
  buildBaseBrowseFilters,
  buildBrowseFilters,
  buildChannelStats,
  buildConversationItems,
  clampOffset,
  filterAndSortPosts,
  getLastActivityAt,
  listChannels,
  nextChannelFilter,
  nextValue,
  offsetForPage,
  paginateItems,
  resolveConversationSelection,
  resolvePageOffsetForId,
  resolveSelectedIndex,
} from "@/cli/commands/browse/selectors.js";
import { BUNDLE, POSTS, toBrowsePost } from "./browse.fixtures.js";

describe("browse selectors", () => {
  it("keeps the focused post selected after refresh", () => {
    expect(resolveSelectedIndex(POSTS, 0, "P-2")).toBe(1);
    expect(resolveSelectedIndex(POSTS, 1, "P-missing")).toBe(1);
    expect(resolveSelectedIndex([], 1, "P-1")).toBe(0);
  });

  it("builds base and resolved browse filters", () => {
    expect(
      buildBaseBrowseFilters({
        severity: "warning",
        type: "question",
        status: "open",
        assignedTo: "claude:backend",
      })
    ).toEqual({
      channel: undefined,
      severity: "warning",
      type: "question",
      status: "open",
      tag: undefined,
      text: undefined,
      pinned: undefined,
      unreadForSession: undefined,
      subscribedForActor: undefined,
      assignedTo: "claude:backend",
      waitingForActor: undefined,
    });

    expect(
      buildBrowseFilters({
        channel: "backend",
        type: "question",
        status: "open",
        pinned: true,
        limit: 30,
      })
    ).toEqual({
      channel: "backend",
      type: "question",
      status: "open",
      severity: undefined,
      tag: undefined,
      text: undefined,
      pinned: true,
      unreadForSession: undefined,
      subscribedForActor: undefined,
      assignedTo: undefined,
      waitingForActor: undefined,
      limit: 30,
    });
  });

  it("lists channels and cycles through options", () => {
    expect(listChannels(POSTS)).toEqual(["general"]);
    expect(nextChannelFilter(["backend", "general"], ALL_CHANNELS)).toBe("backend");
    expect(nextChannelFilter(["backend", "general"], "general")).toBe(ALL_CHANNELS);
    expect(nextValue(SORT_MODES, "activity")).toBe("recent");
    expect(nextValue(SORT_MODES, "channel")).toBe("activity");
    expect(nextValue(CONVERSATION_FILTER_MODES, "all")).toBe("original");
    expect(nextValue(CONVERSATION_SORT_MODES, "recent")).toBe("thread");
  });

  it("computes last activity and sorts posts accordingly", () => {
    const withActivity = [
      toBrowsePost(
        { ...POSTS[0], channel: "backend" },
        {
          lastActivityAt: "2026-03-13T12:03:00.000Z",
          replyCount: 1,
          searchMatch: {
            kind: "body",
            kinds: ["body"],
            excerpt: "token rotation details",
            rank: 3,
          },
        }
      ),
      toBrowsePost(
        { ...POSTS[1], channel: "frontend" },
        {
          lastActivityAt: "2026-03-13T12:02:00.000Z",
          searchMatch: {
            kind: "title",
            kinds: ["title"],
            excerpt: "Decision 2",
            rank: 1,
          },
        }
      ),
    ];

    expect(
      getLastActivityAt(POSTS[0], {
        replies: [{ createdAt: "2026-03-13T12:03:00.000Z" }],
        reactions: [{ createdAt: "2026-03-13T12:02:30.000Z" }],
      })
    ).toBe("2026-03-13T12:03:00.000Z");

    expect(
      filterAndSortPosts(withActivity, {
        channelFilter: ALL_CHANNELS,
        sortMode: "activity",
        limit: 10,
      }).items.map((post) => post.id)
    ).toEqual(["P-2", "P-1"]);
    expect(
      filterAndSortPosts(withActivity, {
        channelFilter: "frontend",
        sortMode: "activity",
        limit: 10,
      }).items.map((post) => post.id)
    ).toEqual(["P-2"]);
  });

  it("paginateItems slices correctly and computes pagination metadata", () => {
    const items = ["a", "b", "c", "d", "e"];

    const page1 = paginateItems(items, { limit: 2, offset: 0 });
    expect(page1.items).toEqual(["a", "b"]);
    expect(page1.totalCount).toBe(5);
    expect(page1.totalPages).toBe(3);
    expect(page1.page).toBe(1);
    expect(page1.rangeStart).toBe(1);
    expect(page1.rangeEnd).toBe(2);

    const page2 = paginateItems(items, { limit: 2, offset: 2 });
    expect(page2.items).toEqual(["c", "d"]);
    expect(page2.page).toBe(2);
    expect(page2.rangeStart).toBe(3);
    expect(page2.rangeEnd).toBe(4);

    const lastPage = paginateItems(items, { limit: 2, offset: 4 });
    expect(lastPage.items).toEqual(["e"]);
    expect(lastPage.page).toBe(3);
    expect(lastPage.rangeEnd).toBe(5);

    const empty = paginateItems([], { limit: 10, offset: 0 });
    expect(empty.items).toHaveLength(0);
    expect(empty.totalCount).toBe(0);
    expect(empty.totalPages).toBe(1);
    expect(empty.rangeStart).toBe(0);
    expect(empty.rangeEnd).toBe(0);
  });

  it("clampOffset keeps offset within valid bounds", () => {
    expect(clampOffset(0, 10, 3)).toBe(0);
    expect(clampOffset(-5, 10, 3)).toBe(0);
    expect(clampOffset(100, 10, 3)).toBe(9);
    expect(clampOffset(9, 10, 3)).toBe(9);
    expect(clampOffset(0, 0, 3)).toBe(0);
  });

  it("offsetForPage converts 1-based page to offset", () => {
    expect(offsetForPage(1, 10)).toBe(0);
    expect(offsetForPage(2, 10)).toBe(10);
    expect(offsetForPage(3, 5)).toBe(10);
    expect(offsetForPage(0, 10)).toBe(0);
  });

  it("resolvePageOffsetForId keeps focused item in view after refresh", () => {
    const items = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }, { id: "E" }];
    const limit = 2;

    const offset = resolvePageOffsetForId(items, { focusedId: "C", currentOffset: 0, limit });
    expect(offset).toBe(2);

    const samePageOffset = resolvePageOffsetForId(items, {
      focusedId: "B",
      currentOffset: 0,
      limit,
    });
    expect(samePageOffset).toBe(0);

    const missingId = resolvePageOffsetForId(items, { focusedId: "Z", currentOffset: 4, limit });
    expect(missingId).toBe(4);
  });

  it("builds channel stats and conversation items", () => {
    const browsePosts = [
      toBrowsePost(
        { ...POSTS[0], channel: "backend" },
        { lastActivityAt: "2026-03-13T12:03:00.000Z" }
      ),
      toBrowsePost(
        { ...POSTS[1], channel: "backend" },
        { lastActivityAt: "2026-03-13T12:01:00.000Z" }
      ),
      toBrowsePost(
        { ...POSTS[0], id: "P-3", channel: "frontend" },
        { lastActivityAt: "2026-03-13T12:05:00.000Z" }
      ),
    ];

    const stats = buildChannelStats(browsePosts);
    expect(stats[0]).toEqual({
      name: "frontend",
      threadCount: 1,
      lastActivityAt: "2026-03-13T12:05:00.000Z",
    });

    expect(
      buildConversationItems(BUNDLE, { filterMode: "all", sortMode: "thread" }).map(
        (item) => item.label
      )
    ).toEqual(["Post original", "Reply 1", "Reply 2"]);

    const recentReplies = buildConversationItems(BUNDLE, {
      filterMode: "replies",
      sortMode: "recent",
    });
    expect(recentReplies.map((item) => item.label)).toEqual(["Reply 2", "Reply 1"]);
    expect(resolveConversationSelection(recentReplies, 1)).toBe(0);
  });
});
