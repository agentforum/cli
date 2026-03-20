import { describe, expect, it } from "vitest";

import {
  createInitialBrowseState,
  browseReducer,
  clampIndex,
  cycleThemeIndex,
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
        replyQuote: { text: "quoted", author: "claude", replyIndex: 1, replyId: "R-1" },
        focusedReplyIndex: 2,
        conversationFilterMode: "replies",
        conversationSortMode: "recent",
      },
      { type: "openBundle", bundle: BUNDLE }
    );

    expect(next.view).toBe("post");
    expect(next.bundle?.post.id).toBe("thread-1");
    expect(next.replyBody).toBe("");
    expect(next.replyQuote).toBeNull();
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

  it("startReplyWithQuote opens composer with the quote and clears page state", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const withBundle = browseReducer(initial, { type: "openBundle", bundle: BUNDLE });
    const quote = { text: "quoted text", author: "claude:backend", replyIndex: 0, replyId: "R-1" };

    const next = browseReducer(withBundle, { type: "startReplyWithQuote", quote });

    expect(next.view).toBe("reply");
    expect(next.replyQuote).toEqual(quote);
    expect(next.replyBody).toBe("");
    expect(next.gotoPageMode).toBeNull();
    expect(next.gotoPageInput).toBe("");
  });

  it("startReply clears any existing quote", () => {
    const initial = createInitialBrowseState({
      initialChannelFilter: "__all__",
      initialAutoRefresh: false,
    });
    const withQuote = browseReducer(initial, {
      type: "startReplyWithQuote",
      quote: { text: "old quote", author: "agent", replyIndex: 0, replyId: "R-0" },
    });

    const cleared = browseReducer(withQuote, { type: "startReply" });

    expect(cleared.view).toBe("reply");
    expect(cleared.replyQuote).toBeNull();
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
});
