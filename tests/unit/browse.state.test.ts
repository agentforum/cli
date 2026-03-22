import { describe, expect, it } from "vitest";

import {
  createInitialBrowseState,
  browseReducer,
  clampIndex,
  cycleThemeIndex,
  resolveDeleteTransition,
} from "@/cli/commands/browse/state.js";
import { BUNDLE } from "./browse.fixtures.js";

describe("browse state", () => {
  it("creates the expected initial state", () => {
    const state = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: true,
      initialSearchQuery: "oauth",
    });

    expect(state.view).toBe("list");
    expect(state.autoRefreshEnabled).toBe(true);
    expect(state.channelFilter).toBe("__all__");
    expect(state.listOffset).toBe(0);
    expect(state.replyPage).toBe(1);
    expect(state.searchMode).toBe(false);
    expect(state.searchQuery).toBe("oauth");
    expect(state.searchDraftQuery).toBe("oauth");
  });

  it("opens a bundle and resets conversation state", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const next = browseReducer(
      {
        ...initial,
        view: "reply",
        replyBody: "draft",
        replyQuotes: [
          {
            id: "R-1",
            kind: "reply",
            label: "Reply 2",
            text: "quoted",
            author: "claude",
            replyIndex: 1,
          },
        ],
        focusedReplyIndex: 2,
        conversationFilterMode: "replies",
        conversationSortMode: "recent",
      },
      { type: "openBundle", bundle: BUNDLE }
    );

    expect(next.view).toBe("post");
    expect(next.bundle?.post.id).toBe("thread-1");
    expect(next.replyBody).toBe("");
    expect(next.replyQuotes).toEqual([]);
    expect(next.focusedReplyIndex).toBe(-1);
    expect(next.conversationFilterMode).toBe("all");
    expect(next.replyPage).toBe(1);
  });

  it("supports patch updates and reply body changes", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const patched = browseReducer(initial, {
      type: "patch",
      patch: { showShortcutsHelp: true, searchDraftQuery: "draft only" },
    });
    const withBody = browseReducer(patched, { type: "setReplyBody", value: "hello" });

    expect(patched.showShortcutsHelp).toBe(true);
    expect(patched.searchQuery).toBe("");
    expect(patched.searchDraftQuery).toBe("draft only");
    expect(withBody.replyBody).toBe("hello");
  });

  it("clamps indices and cycles themes", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(5, 3)).toBe(2);
    expect(cycleThemeIndex(4, 5)).toBe(0);
  });

  it("startReply opens composer and preserves selected quotes", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const withBundle = browseReducer(
      {
        ...initial,
        replyQuotes: [
          {
            id: "R-1",
            kind: "reply",
            label: "Reply 1",
            text: "quoted text",
            author: "claude:backend",
            replyIndex: 0,
          },
        ],
      },
      { type: "openBundle", bundle: BUNDLE }
    );
    const withQuotes = {
      ...withBundle,
      replyQuotes: [
        {
          id: "thread-1",
          kind: "post" as const,
          label: "Original post",
          text: "original body",
          author: "claude:backend",
          replyIndex: -1,
        },
      ],
    };

    const next = browseReducer(withQuotes, { type: "startReply" });

    expect(next.view).toBe("reply");
    expect(next.replyQuotes).toEqual(withQuotes.replyQuotes);
    expect(next.replyBody).toBe("");
    expect(next.gotoPageMode).toBeNull();
    expect(next.gotoPageInput).toBe("");
  });

  it("startReply keeps any existing quotes selected", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const withQuote = {
      ...initial,
      replyQuotes: [
        {
          id: "R-0",
          kind: "reply" as const,
          label: "Reply 1",
          text: "old quote",
          author: "agent",
          replyIndex: 0,
        },
      ],
    };

    const cleared = browseReducer(withQuote, { type: "startReply" });

    expect(cleared.view).toBe("reply");
    expect(cleared.replyQuotes).toEqual(withQuote.replyQuotes);
  });

  it("returnToList resets modal and delete confirmation state", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const dirty = browseReducer(initial, {
      type: "patch",
      patch: { showShortcutsHelp: true, confirmDelete: null },
    });

    const back = browseReducer(dirty, { type: "returnToList" });

    expect(back.view).toBe("list");
    expect(back.showShortcutsHelp).toBe(false);
    expect(back.gotoPageMode).toBeNull();
    expect(back.confirmDelete).toBeNull();
  });

  it("closes the open thread and clears focus when deleting the selected post", () => {
    const next = resolveDeleteTransition({
      currentBundle: BUNDLE,
      currentView: "post",
      currentFocusedId: BUNDLE.post.id,
      deletedPostId: BUNDLE.post.id,
    });

    expect(next.bundle).toBeNull();
    expect(next.view).toBe("list");
    expect(next.focusedId).toBeNull();
  });

  it("keeps the current thread open when deleting a different selected post", () => {
    const next = resolveDeleteTransition({
      currentBundle: BUNDLE,
      currentView: "post",
      currentFocusedId: "P-2",
      deletedPostId: "P-2",
    });

    expect(next.bundle).toBe(BUNDLE);
    expect(next.view).toBe("post");
    expect(next.focusedId).toBeNull();
  });
});
