import { describe, expect, it } from "vitest";

import type { PostRecord, ReadPostBundle } from "../../src/domain/types.js";
import {
  ALL_CHANNELS,
  type BrowseListPost,
  CONVERSATION_FILTER_MODES,
  CONVERSATION_SORT_MODES,
  SORT_MODES,
  buildConversationItems,
  buildBrowseFilters,
  buildBaseBrowseFilters,
  buildChannelStats,
  DEFAULT_REFRESH_MS,
  buildBrowseHint,
  buildReadProgressLabel,
  buildFilterSummary,
  describeConversationFilterMode,
  describeConversationSortMode,
  describeRefreshMs,
  describeSortMode,
  filterAndSortPosts,
  getLastActivityAt,
  getPostTypeTone,
  getStatusTone,
  listChannels,
  nextChannelFilter,
  nextValue,
  parseLimit,
  parseRefreshMs,
  resolveConversationSelection,
  excerpt,
  resolveSelectedIndex,
  sanitizeTerminalText,
  severityColor,
  statusIcon,
  timeAgo,
  typeIcon
} from "../../src/cli/commands/browse.lib.js";

const POSTS: PostRecord[] = [
  {
    id: "P-1",
    channel: "general",
    type: "question",
    title: "Question 1",
    body: "Body",
    data: null,
    severity: null,
    status: "open",
    actor: "test:agent",
    session: null,
    tags: [],
    pinned: false,
    refId: null,
    blocking: false,
    assignedTo: null,
    idempotencyKey: null,
    createdAt: "2026-03-13T12:00:00.000Z"
  },
  {
    id: "P-2",
    channel: "general",
    type: "decision",
    title: "Decision 2",
    body: "Body",
    data: null,
    severity: null,
    status: "answered",
    actor: "test:agent",
    session: null,
    tags: [],
    pinned: false,
    refId: null,
    blocking: false,
    assignedTo: null,
    idempotencyKey: null,
    createdAt: "2026-03-13T12:01:00.000Z"
  }
];

function toBrowsePost(post: PostRecord, overrides?: Partial<BrowseListPost>): BrowseListPost {
  return {
    ...post,
    lastActivityAt: post.createdAt,
    replyCount: 0,
    reactionCount: 0,
    lastReplyExcerpt: null,
    lastReplyActor: null,
    ...overrides
  };
}

const BUNDLE: ReadPostBundle = {
  post: {
    ...POSTS[0],
    id: "thread-1",
    title: "Original thread",
    body: "Original body",
    createdAt: "2026-03-13T12:00:00.000Z"
  },
  replies: [
    {
      id: "R-1",
      postId: "thread-1",
      body: "First reply body",
      data: null,
      actor: "claude:backend",
      session: null,
      createdAt: "2026-03-13T12:05:00.000Z"
    },
    {
      id: "R-2",
      postId: "thread-1",
      body: "Second reply body",
      data: null,
      actor: "claude:frontend",
      session: "sess-2",
      createdAt: "2026-03-13T12:10:00.000Z"
    }
  ],
  reactions: []
};

describe("browse helpers", () => {
  it("parses the default limit and refresh interval", () => {
    expect(parseLimit()).toBe(30);
    expect(parseRefreshMs()).toBe(DEFAULT_REFRESH_MS);
  });

  it("rejects invalid limit and refresh interval values", () => {
    expect(() => parseLimit("0")).toThrow("--limit must be a positive integer.");
    expect(() => parseRefreshMs("999")).toThrow("--refresh-ms must be an integer >= 1000.");
  });

  it("keeps the focused post selected after refresh", () => {
    expect(resolveSelectedIndex(POSTS, 0, "P-2")).toBe(1);
    expect(resolveSelectedIndex(POSTS, 1, "P-missing")).toBe(1);
    expect(resolveSelectedIndex([], 1, "P-1")).toBe(0);
  });

  it("does not force a channel filter when none is provided", () => {
    expect(
      buildBaseBrowseFilters({
        severity: "warning",
        type: "question",
        status: "open",
        assignedTo: "claude:backend"
      })
    ).toEqual({
      channel: undefined,
      severity: "warning",
      type: "question",
      status: "open",
      tag: undefined,
      pinned: undefined,
      unreadForSession: undefined,
      subscribedForActor: undefined,
      assignedTo: "claude:backend",
      waitingForActor: undefined
    });

    expect(
      buildBrowseFilters({
        severity: "warning",
        type: "question",
        status: "open",
        assignedTo: "claude:backend",
        limit: 30
      })
    ).toEqual({
      channel: undefined,
      severity: "warning",
      type: "question",
      status: "open",
      tag: undefined,
      pinned: undefined,
      unreadForSession: undefined,
      subscribedForActor: undefined,
      assignedTo: "claude:backend",
      waitingForActor: undefined,
      limit: 30
    });

    expect(
      buildBrowseFilters({
        channel: "backend",
        type: "question",
        status: "open",
        pinned: true,
        limit: 30
      })
    ).toEqual({
      channel: "backend",
      type: "question",
      status: "open",
      severity: undefined,
      tag: undefined,
      pinned: true,
      unreadForSession: undefined,
      subscribedForActor: undefined,
      assignedTo: undefined,
      waitingForActor: undefined,
      limit: 30
    });
  });

  it("builds readable filter and shortcut text with refresh state", () => {
    expect(
      buildFilterSummary(
        { channel: "general", type: "question", status: "open", assignedTo: "claude:backend" },
        12,
        { autoRefreshEnabled: true, refreshMs: 5000, lastRefreshAt: "12:30:10", sortMode: "activity" }
      )
    ).toContain("auto: on (5s)");
    expect(
      buildFilterSummary(
        { channel: "general", type: "question", status: "open", assignedTo: "claude:backend" },
        12,
        { autoRefreshEnabled: true, refreshMs: 5000, lastRefreshAt: "12:30:10", sortMode: "activity" }
      )
    ).toContain("sort: last activity");
    expect(
      buildFilterSummary(
        { channel: "general", type: "question", status: "open", assignedTo: "claude:backend" },
        12,
        { autoRefreshEnabled: true, refreshMs: 5000, lastRefreshAt: "12:30:10", sortMode: "activity" }
      )
    ).toContain("assigned: claude:backend");
  });

  it("builds contextual hints per view", () => {
    expect(buildBrowseHint("list", 5, { autoRefreshEnabled: true, refreshMs: 5000 })).toContain("Enter open");
    expect(buildBrowseHint("list", 5, { autoRefreshEnabled: true, refreshMs: 5000 })).toContain("? shortcuts");
    expect(buildBrowseHint("list", 5, { autoRefreshEnabled: true, refreshMs: 5000 })).not.toContain("d delete");
    expect(buildBrowseHint("list", 0, { autoRefreshEnabled: false, refreshMs: 3000 })).not.toContain("Enter");
    expect(buildBrowseHint("post", 5, { autoRefreshEnabled: false, refreshMs: 3000 })).toContain("r reply");
    expect(buildBrowseHint("post", 5, { autoRefreshEnabled: false, refreshMs: 3000 })).toContain("? shortcuts");
    expect(buildBrowseHint("post", 5, { autoRefreshEnabled: false, refreshMs: 3000 })).toContain("b back");
    expect(buildBrowseHint("reply", 5, { autoRefreshEnabled: false, refreshMs: 3000 })).toContain("Ctrl+Enter");
    expect(buildBrowseHint("reply", 5, { autoRefreshEnabled: false, refreshMs: 3000 })).toContain("Esc cancel");
    expect(buildBrowseHint("reply", 5, { autoRefreshEnabled: false, refreshMs: 3000 })).toContain("? shortcuts");
    expect(buildBrowseHint("channels", 5, { autoRefreshEnabled: true, refreshMs: 5000 })).toContain("Enter select");
    expect(buildBrowseHint("channels", 5, { autoRefreshEnabled: true, refreshMs: 5000 })).toContain("? shortcuts");
  });

  it("formats refresh labels and exposes badge tones", () => {
    expect(describeRefreshMs(5000)).toBe("5s");
    expect(describeRefreshMs(1250)).toBe("1250ms");
    expect(describeSortMode("channel")).toBe("channel (A-Z)");
    expect(getPostTypeTone("finding")).toEqual({ color: "black", backgroundColor: "yellow" });
    expect(getStatusTone("answered")).toEqual({ color: "black", backgroundColor: "green" });
    expect(severityColor("critical")).toBe("red");
    expect(severityColor("warning")).toBe("yellow");
    expect(severityColor("info")).toBe("cyan");
  });

  it("lists channels and cycles through channel and sort options", () => {
    expect(listChannels(POSTS)).toEqual(["general"]);
    expect(nextChannelFilter(["backend", "general"], ALL_CHANNELS)).toBe("backend");
    expect(nextChannelFilter(["backend", "general"], "general")).toBe(ALL_CHANNELS);
    expect(nextValue(SORT_MODES, "activity")).toBe("recent");
    expect(nextValue(SORT_MODES, "channel")).toBe("activity");
    expect(nextValue(CONVERSATION_FILTER_MODES, "all")).toBe("original");
    expect(nextValue(CONVERSATION_FILTER_MODES, "replies")).toBe("all");
    expect(nextValue(CONVERSATION_SORT_MODES, "thread")).toBe("recent");
    expect(nextValue(CONVERSATION_SORT_MODES, "recent")).toBe("thread");
  });

  it("computes last activity and sorts posts accordingly", () => {
    const withActivity: BrowseListPost[] = [
      toBrowsePost({ ...POSTS[0], channel: "backend" }, { lastActivityAt: "2026-03-13T12:03:00.000Z", replyCount: 1 }),
      toBrowsePost({ ...POSTS[1], channel: "frontend" }, { lastActivityAt: "2026-03-13T12:02:00.000Z" })
    ];

    expect(
      getLastActivityAt(POSTS[0], {
        replies: [{ createdAt: "2026-03-13T12:03:00.000Z" }],
        reactions: [{ createdAt: "2026-03-13T12:02:30.000Z" }]
      })
    ).toBe("2026-03-13T12:03:00.000Z");

    expect(filterAndSortPosts(withActivity, { channelFilter: ALL_CHANNELS, sortMode: "activity", limit: 10 }).map((post) => post.id)).toEqual([
      "P-1",
      "P-2"
    ]);
    expect(filterAndSortPosts(withActivity, { channelFilter: "frontend", sortMode: "activity", limit: 10 }).map((post) => post.id)).toEqual([
      "P-2"
    ]);
    expect(filterAndSortPosts(withActivity, { channelFilter: ALL_CHANNELS, sortMode: "channel", limit: 10 }).map((post) => post.id)).toEqual([
      "P-1",
      "P-2"
    ]);
    expect(filterAndSortPosts(withActivity, { channelFilter: ALL_CHANNELS, sortMode: "title", limit: 10 }).map((post) => post.id)).toEqual([
      "P-2",
      "P-1"
    ]);
  });

  it("computes relative time descriptions", () => {
    const now = new Date("2026-03-13T14:00:00.000Z");
    expect(timeAgo("2026-03-13T13:59:30.000Z", now)).toBe("just now");
    expect(timeAgo("2026-03-13T13:55:00.000Z", now)).toBe("5m ago");
    expect(timeAgo("2026-03-13T12:00:00.000Z", now)).toBe("2h ago");
    expect(timeAgo("2026-03-12T14:00:00.000Z", now)).toBe("1d ago");
    expect(timeAgo("2026-03-10T14:00:00.000Z", now)).toBe("3d ago");
  });

  it("builds channel stats from posts", () => {
    const browsePosts: BrowseListPost[] = [
      toBrowsePost({ ...POSTS[0], channel: "backend" }, { lastActivityAt: "2026-03-13T12:03:00.000Z" }),
      toBrowsePost({ ...POSTS[1], channel: "backend" }, { lastActivityAt: "2026-03-13T12:01:00.000Z" }),
      toBrowsePost({ ...POSTS[0], id: "P-3", channel: "frontend" }, { lastActivityAt: "2026-03-13T12:05:00.000Z" })
    ];

    const stats = buildChannelStats(browsePosts);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual({ name: "frontend", threadCount: 1, lastActivityAt: "2026-03-13T12:05:00.000Z" });
    expect(stats[1]).toEqual({ name: "backend", threadCount: 2, lastActivityAt: "2026-03-13T12:03:00.000Z" });
  });

  it("builds conversation items and resolves visible selection", () => {
    expect(
      buildConversationItems(BUNDLE, { filterMode: "all", sortMode: "thread" }).map((item) => item.label)
    ).toEqual(["Post original", "Reply 1", "Reply 2"]);

    expect(
      buildConversationItems(BUNDLE, { filterMode: "original", sortMode: "thread" }).map((item) => item.label)
    ).toEqual(["Post original"]);

    const recentReplies = buildConversationItems(BUNDLE, { filterMode: "replies", sortMode: "recent" });
    expect(recentReplies.map((item) => item.label)).toEqual(["Reply 2", "Reply 1"]);
    expect(resolveConversationSelection(recentReplies, 1)).toBe(0);
    expect(resolveConversationSelection(recentReplies, -1)).toBe(0);
  });

  it("describes conversation modes and read progress labels", () => {
    expect(describeConversationFilterMode("all")).toBe("all");
    expect(describeConversationFilterMode("replies")).toBe("replies");
    expect(describeConversationSortMode("thread")).toBe("thread order");
    expect(describeConversationSortMode("recent")).toBe("newest first");
    expect(buildReadProgressLabel(0, 0, 0)).toBe("[100% read]");
    expect(buildReadProgressLabel(0, 200, 100)).toBe("[0% read]");
    expect(buildReadProgressLabel(50, 200, 100)).toBe("[50% read]");
    expect(buildReadProgressLabel(100, 200, 100)).toBe("[100% read]");
  });

  it("returns status and type icons", () => {
    expect(statusIcon("answered")).toBe("\u2713");
    expect(statusIcon("open")).toBe("\u25CB");
    expect(statusIcon("wont-answer")).toBe("\u2717");
    expect(statusIcon("stale")).toBe("~");
    expect(statusIcon("needs-clarification")).toBe("?");
    expect(statusIcon("unknown-status")).toBe("\u25CB");

    expect(typeIcon("finding")).toBe("\u2691");
    expect(typeIcon("question")).toBe("?");
    expect(typeIcon("decision")).toBe("\u2713");
    expect(typeIcon("note")).toBe("\u266A");
    expect(typeIcon("unknown-type")).toBe("\u00B7");
  });

  it("truncates text excerpts with ellipsis", () => {
    expect(excerpt("short")).toBe("short");
    expect(excerpt("line one\nline two")).toBe("line one line two");
    const long = "a".repeat(100);
    const result = excerpt(long);
    expect(result.length).toBe(80);
    expect(result.endsWith("\u2026")).toBe(true);
    expect(excerpt("exact", 5)).toBe("exact");
    expect(excerpt("toolong", 5)).toBe("tool\u2026");
  });

  it("sanitizes astral unicode for terminal rendering", () => {
    expect(sanitizeTerminalText("🟢 ALLOW\n🔴 DENY")).toBe("[green] ALLOW\n[red] DENY");
    expect(sanitizeTerminalText("Política\tválida")).toBe("Política  válida");
    expect(sanitizeTerminalText("ok 😀")).toBe("ok [?]");
  });
});
