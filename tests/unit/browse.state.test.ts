import { describe, expect, it } from "vitest";

import { createInitialBrowseState, browseReducer, clampIndex, cycleThemeIndex } from "../../src/cli/commands/browse/state.js";
import { BUNDLE } from "./browse.fixtures.js";

describe("browse state", () => {
  it("creates the expected initial state", () => {
    const state = createInitialBrowseState({ initialChannelFilter: "__all__", initialAutoRefresh: true });

    expect(state.view).toBe("list");
    expect(state.autoRefreshEnabled).toBe(true);
    expect(state.channelFilter).toBe("__all__");
  });

  it("opens a bundle and resets conversation state", () => {
    const initial = createInitialBrowseState({ initialChannelFilter: "__all__", initialAutoRefresh: false });
    const next = browseReducer(
      {
        ...initial,
        view: "reply",
        replyBody: "draft",
        focusedReplyIndex: 2,
        conversationFilterMode: "replies",
        conversationSortMode: "recent"
      },
      { type: "openBundle", bundle: BUNDLE }
    );

    expect(next.view).toBe("post");
    expect(next.bundle?.post.id).toBe("thread-1");
    expect(next.replyBody).toBe("");
    expect(next.focusedReplyIndex).toBe(-1);
    expect(next.conversationFilterMode).toBe("all");
  });

  it("supports patch updates and reply body changes", () => {
    const initial = createInitialBrowseState({ initialChannelFilter: "__all__", initialAutoRefresh: false });
    const patched = browseReducer(initial, { type: "patch", patch: { showShortcutsHelp: true } });
    const withBody = browseReducer(patched, { type: "setReplyBody", value: "hello" });

    expect(patched.showShortcutsHelp).toBe(true);
    expect(withBody.replyBody).toBe("hello");
  });

  it("clamps indices and cycles themes", () => {
    expect(clampIndex(-1, 3)).toBe(0);
    expect(clampIndex(5, 3)).toBe(2);
    expect(cycleThemeIndex(4, 5)).toBe(0);
  });
});
