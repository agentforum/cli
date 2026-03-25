import { describe, expect, it } from "vitest";

import { resolveBrowseKeyCommand } from "@/cli/commands/browse/keybindings.js";

const baseState = {
  view: "list" as const,
  showShortcutsHelp: false,
  confirmDelete: false,
  gotoPageMode: null,
  searchMode: false,
  reactionPickerMode: null,
  searchBuilderActive: false,
  busyOperationKind: null,
  hasActiveSearch: false,
  replyBody: "",
  replySectionFocus: "editor" as const,
  postPanelFocus: "index" as const,
  conversationFilterMode: "all" as const,
  focusedReplyIndex: -1,
  canQuoteReply: false,
  hasSelectedPost: true,
  hasBundle: true,
  hasRefPost: false,
  hasActiveReplyRefs: false,
  channelSelectedIndex: 0,
  channelCount: 3,
  postsLength: 2,
  selectedConversationIndex: 0,
  conversationItemsLength: 2,
  composeFieldKind: null,
  composeFieldSupportsPicker: false,
  composePickerOpen: false,
  composeSuggestionCount: 0,
};

function key(
  sequence: string,
  overrides: Partial<{
    name: string;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
    shift: boolean;
  }> = {}
) {
  return {
    name: overrides.name ?? sequence,
    sequence,
    ctrl: overrides.ctrl ?? false,
    alt: overrides.alt ?? false,
    meta: overrides.meta ?? false,
    shift: overrides.shift ?? false,
  };
}

describe("browse keybindings", () => {
  it("maps global shortcuts", () => {
    expect(resolveBrowseKeyCommand(baseState, key("?", { name: "?" }))).toEqual({
      type: "toggleShortcuts",
    });
    expect(resolveBrowseKeyCommand(baseState, key("t", { name: "t" }))).toEqual({
      type: "cycleTheme",
    });
    expect(resolveBrowseKeyCommand(baseState, key("u", { name: "u" }))).toEqual({
      type: "manualRefresh",
    });
  });

  it("maps list navigation and selection", () => {
    expect(resolveBrowseKeyCommand(baseState, key("n", { name: "n" }))).toEqual({
      type: "openPostComposer",
    });
    expect(resolveBrowseKeyCommand(baseState, key("\u001B[A", { name: "up" }))).toEqual({
      type: "listMove",
      delta: -1,
    });
    expect(resolveBrowseKeyCommand(baseState, key("\u001B[B", { name: "down" }))).toEqual({
      type: "listMove",
      delta: 1,
    });
    expect(resolveBrowseKeyCommand(baseState, key("\r", { name: "enter" }))).toEqual({
      type: "openSelectedPost",
    });
    expect(resolveBrowseKeyCommand(baseState, key("/", { name: "/" }))).toEqual({
      type: "openSearch",
    });
    expect(resolveBrowseKeyCommand(baseState, key("]", { name: "]" }))).toEqual({
      type: "listPageNext",
    });
    expect(resolveBrowseKeyCommand(baseState, key("\u001B[5~", { name: "pageup" }))).toEqual({
      type: "listPagePrev",
    });
    expect(resolveBrowseKeyCommand(baseState, key("\u001B[6~", { name: "pagedown" }))).toEqual({
      type: "listPageNext",
    });
    expect(resolveBrowseKeyCommand(baseState, key("G", { name: "G", shift: true }))).toEqual({
      type: "openGotoPage",
      mode: "list",
    });
    expect(resolveBrowseKeyCommand(baseState, key("G", { name: "g", shift: false }))).toEqual({
      type: "openGotoPage",
      mode: "list",
    });
    expect(resolveBrowseKeyCommand(baseState, key("\u001B", { name: "escape" }))).toEqual({
      type: "openChannels",
    });
  });

  it("clears the active search from list view with escape", () => {
    expect(
      resolveBrowseKeyCommand(
        { ...baseState, hasActiveSearch: true },
        key("\u001B", { name: "escape" })
      )
    ).toEqual({
      type: "clearSearch",
    });
  });

  it("maps channels navigation and back actions", () => {
    const channelsState = { ...baseState, view: "channels" as const };
    expect(resolveBrowseKeyCommand(channelsState, key("n", { name: "n" }))).toEqual({
      type: "openPostComposer",
    });
    expect(resolveBrowseKeyCommand(channelsState, key("s", { name: "s" }))).toEqual({
      type: "openSubscriptionComposer",
    });
    expect(resolveBrowseKeyCommand(channelsState, key("\u001B", { name: "escape" }))).toEqual({
      type: "channelsBack",
    });
    expect(resolveBrowseKeyCommand(channelsState, key("\t", { name: "tab" }))).toEqual({
      type: "channelsBack",
    });
  });

  it("maps search editing commands", () => {
    const searchState = { ...baseState, searchMode: true as const };
    expect(resolveBrowseKeyCommand(searchState, key("a", { name: "a" }))).toEqual({
      type: "noop",
    });
    expect(resolveBrowseKeyCommand(searchState, key(" ", { name: "space" }))).toEqual({
      type: "noop",
    });
    expect(resolveBrowseKeyCommand(searchState, key("\u007F", { name: "backspace" }))).toEqual({
      type: "searchBackspace",
    });
    expect(resolveBrowseKeyCommand(searchState, key("\t", { name: "tab" }))).toEqual({
      type: "searchComplete",
      direction: 1,
    });
    expect(resolveBrowseKeyCommand(searchState, key("\u001B[Z", { name: "backtab" }))).toEqual({
      type: "searchComplete",
      direction: -1,
    });
    expect(resolveBrowseKeyCommand(searchState, key("\t", { name: "tab", shift: true }))).toEqual({
      type: "searchComplete",
      direction: -1,
    });
    expect(resolveBrowseKeyCommand(searchState, key("/", { name: "/" }))).toEqual({
      type: "openSearchBuilder",
    });
  });

  it("maps search builder navigation and apply commands", () => {
    const builderState = {
      ...baseState,
      searchMode: true as const,
      searchBuilderActive: true as const,
    };
    expect(resolveBrowseKeyCommand(builderState, key("\u001B[C", { name: "right" }))).toEqual({
      type: "searchBuilderSegment",
      delta: 1,
    });
    expect(resolveBrowseKeyCommand(builderState, key("\u001B[A", { name: "up" }))).toEqual({
      type: "searchBuilderCycle",
      delta: -1,
    });
    expect(resolveBrowseKeyCommand(builderState, key("\u007F", { name: "backspace" }))).toEqual({
      type: "searchBuilderBackspace",
    });
    expect(resolveBrowseKeyCommand(builderState, key("\r", { name: "enter" }))).toEqual({
      type: "applySearchBuilder",
    });
  });

  it("maps reaction-picker commands before the underlying view", () => {
    const reactionState = {
      ...baseState,
      view: "post" as const,
      reactionPickerMode: "reply" as const,
    };
    expect(resolveBrowseKeyCommand(reactionState, key("\u001B", { name: "escape" }))).toEqual({
      type: "closeReactionPicker",
    });
    expect(resolveBrowseKeyCommand(reactionState, key("j", { name: "j" }))).toEqual({
      type: "reactionMove",
      delta: 1,
    });
    expect(resolveBrowseKeyCommand(reactionState, key("2", { name: "2" }))).toEqual({
      type: "applyReaction",
      index: 1,
    });
    expect(resolveBrowseKeyCommand(reactionState, key("5", { name: "5" }))).toEqual({
      type: "applyReaction",
      index: 4,
    });
    expect(resolveBrowseKeyCommand(reactionState, key("\r", { name: "enter" }))).toEqual({
      type: "applyReaction",
    });
  });

  it("maps reply-mode commands", () => {
    const replyState = { ...baseState, view: "reply" as const, replyBody: "draft" };
    expect(resolveBrowseKeyCommand(replyState, key("\u001B", { name: "escape" }))).toEqual({
      type: "replyCancel",
    });
    expect(resolveBrowseKeyCommand(replyState, key("\t", { name: "tab" }))).toEqual({
      type: "replyFocusNext",
    });
    expect(resolveBrowseKeyCommand(replyState, key("\u001B[Z", { name: "backtab" }))).toEqual({
      type: "replyFocusPrev",
    });
    expect(resolveBrowseKeyCommand(replyState, key("k", { name: "k", ctrl: true }))).toEqual({
      type: "clearReplyQuotes",
    });
    expect(resolveBrowseKeyCommand(replyState, key("y", { name: "y", ctrl: true }))).toEqual({
      type: "copyReplyDraft",
    });
    expect(resolveBrowseKeyCommand(replyState, key("s", { name: "s", ctrl: true }))).toEqual({
      type: "submitReply",
    });
    expect(
      resolveBrowseKeyCommand(
        { ...replyState, replySectionFocus: "quotes" as const },
        key("j", { name: "j" })
      )
    ).toEqual({
      type: "replyMoveQuoteSelection",
      delta: 1,
    });
    expect(
      resolveBrowseKeyCommand(
        { ...replyState, replySectionFocus: "quotes" as const },
        key("\u001B[6~", { name: "pagedown" })
      )
    ).toEqual({
      type: "replyMoveQuoteSelection",
      delta: 5,
    });
    expect(
      resolveBrowseKeyCommand(
        { ...replyState, replySectionFocus: "preview" as const },
        key("\u001B[6~", { name: "pagedown" })
      )
    ).toEqual({
      type: "replyPreviewScroll",
      delta: 12,
    });
  });

  it("maps post-view commands", () => {
    const postState = {
      ...baseState,
      view: "post" as const,
      hasRefPost: true,
      focusedReplyIndex: 1,
    };
    expect(resolveBrowseKeyCommand(postState, key("r", { name: "r" }))).toEqual({
      type: "startReply",
    });
    expect(resolveBrowseKeyCommand(postState, key("n", { name: "n" }))).toEqual({
      type: "openPostComposer",
    });
    expect(resolveBrowseKeyCommand(postState, key("s", { name: "s" }))).toEqual({
      type: "openSubscriptionComposer",
    });
    expect(resolveBrowseKeyCommand(postState, key("e", { name: "e" }))).toEqual({
      type: "openReactionPicker",
    });
    expect(resolveBrowseKeyCommand(postState, key("R", { name: "R", shift: true }))).toEqual({
      type: "openReactionPicker",
    });
    expect(resolveBrowseKeyCommand(postState, key("g", { name: "g" }))).toEqual({
      type: "openReferencedPost",
    });
    expect(resolveBrowseKeyCommand(postState, key("\u001B[C", { name: "right" }))).toEqual({
      type: "postFocus",
      focus: "content",
    });
    expect(resolveBrowseKeyCommand(postState, key("\u001B[5~", { name: "pageup" }))).toEqual({
      type: "postScroll",
      delta: -12,
    });
    expect(resolveBrowseKeyCommand(postState, key("\u001B[6~", { name: "pagedown" }))).toEqual({
      type: "postScroll",
      delta: 12,
    });
    expect(resolveBrowseKeyCommand(postState, key("Q", { name: "Q", shift: true }))).toEqual({
      type: "toggleReplyQuote",
    });
    expect(
      resolveBrowseKeyCommand({ ...postState, hasActiveReplyRefs: true }, key("]", { name: "]" }))
    ).toEqual({
      type: "replyRefNext",
    });
    expect(
      resolveBrowseKeyCommand({ ...postState, hasActiveReplyRefs: true }, key("g", { name: "g" }))
    ).toEqual({
      type: "openSelectedReplyRef",
    });
    expect(resolveBrowseKeyCommand(postState, key("X", { name: "X", shift: true }))).toEqual({
      type: "copyContextPack",
    });
    expect(resolveBrowseKeyCommand(postState, key("x", { name: "x", shift: false }))).toEqual({
      type: "copyContextPack",
    });
    expect(resolveBrowseKeyCommand(postState, key("o", { name: "o", shift: false }))).toEqual({
      type: "cycleConversationSort",
    });
    expect(resolveBrowseKeyCommand(postState, key("w", { name: "w", shift: false }))).toEqual({
      type: "toggleReplyQuote",
    });
  });

  it("maps composer navigation and picker open", () => {
    const postComposerState = {
      ...baseState,
      view: "compose-post" as const,
      composeFieldKind: "text" as const,
      composeFieldSupportsPicker: true,
    };
    expect(resolveBrowseKeyCommand(postComposerState, key("\t", { name: "tab" }))).toEqual({
      type: "composePostNextField",
      delta: 1,
    });
    expect(
      resolveBrowseKeyCommand(postComposerState, key("\u001B[Z", { name: "backtab" }))
    ).toEqual({
      type: "composePostNextField",
      delta: -1,
    });
    expect(resolveBrowseKeyCommand(postComposerState, key("\r", { name: "enter" }))).toEqual({
      type: "composeOpenPicker",
    });
    expect(resolveBrowseKeyCommand(postComposerState, key("\u001B[B", { name: "down" }))).toEqual({
      type: "noop",
    });
    expect(resolveBrowseKeyCommand(postComposerState, key("s", { name: "s", ctrl: true }))).toEqual(
      {
        type: "submitPost",
      }
    );

    const subscriptionComposerState = {
      ...baseState,
      view: "compose-subscription" as const,
      composeFieldKind: "text" as const,
    };
    expect(
      resolveBrowseKeyCommand(subscriptionComposerState, key("\u001B[A", { name: "up" }))
    ).toEqual({
      type: "noop",
    });
    expect(
      resolveBrowseKeyCommand(subscriptionComposerState, key("s", { name: "s", ctrl: true }))
    ).toEqual({
      type: "submitSubscription",
    });
  });

  it("maps picker navigation and quick choose", () => {
    const pickerState = {
      ...baseState,
      view: "compose-post" as const,
      composePickerOpen: true,
      composeSuggestionCount: 3,
    };
    expect(resolveBrowseKeyCommand(pickerState, key("2", { name: "2" }))).toEqual({
      type: "composeApplyPicker",
      index: 1,
    });
    expect(resolveBrowseKeyCommand(pickerState, key("\u001B[B", { name: "down" }))).toEqual({
      type: "composeMovePicker",
      delta: 1,
    });
    expect(resolveBrowseKeyCommand(pickerState, key("\r", { name: "enter" }))).toEqual({
      type: "composeApplyPicker",
    });
  });

  it("cycles composer enums only when the active field is closed-set", () => {
    const postComposerState = {
      ...baseState,
      view: "compose-post" as const,
      composeFieldKind: "enum" as const,
    };
    expect(resolveBrowseKeyCommand(postComposerState, key("\u001B[C", { name: "right" }))).toEqual({
      type: "composePostCycleOption",
      delta: 1,
    });

    const subscriptionComposerState = {
      ...baseState,
      view: "compose-subscription" as const,
      composeFieldKind: "enum" as const,
    };
    expect(
      resolveBrowseKeyCommand(subscriptionComposerState, key("\u001B[D", { name: "left" }))
    ).toEqual({
      type: "composeSubscriptionCycleOption",
      delta: -1,
    });
  });

  it("opens and closes reader mode from the thread view", () => {
    const postState = {
      ...baseState,
      view: "post" as const,
      conversationItemsLength: 3,
      postPanelFocus: "index" as const,
    };

    expect(resolveBrowseKeyCommand(postState, key("\r", { name: "enter" }))).toEqual({
      type: "openReader",
    });

    expect(
      resolveBrowseKeyCommand(
        { ...postState, postPanelFocus: "content" as const },
        key("\r", { name: "enter" })
      )
    ).toEqual({
      type: "openReader",
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const },
        key("\u001B", { name: "escape" })
      )
    ).toEqual({
      type: "closeReader",
    });
    expect(
      resolveBrowseKeyCommand({ ...baseState, view: "reader" as const }, key("e", { name: "e" }))
    ).toEqual({
      type: "openReactionPicker",
    });
    expect(
      resolveBrowseKeyCommand({ ...baseState, view: "reader" as const }, key("s", { name: "s" }))
    ).toEqual({
      type: "openSubscriptionComposer",
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("\u001B[5~", { name: "pageup" })
      )
    ).toEqual({
      type: "readerScroll",
      delta: -12,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("\u001B[6~", { name: "pagedown" })
      )
    ).toEqual({
      type: "readerScroll",
      delta: 12,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("\u001B[A", { name: "up" })
      )
    ).toEqual({
      type: "readerScroll",
      delta: -3,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("\u001B[B", { name: "down" })
      )
    ).toEqual({
      type: "readerScroll",
      delta: 3,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("j", { name: "j" })
      )
    ).toEqual({
      type: "postMoveConversation",
      delta: 1,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("k", { name: "k" })
      )
    ).toEqual({
      type: "postMoveConversation",
      delta: -1,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("n", { name: "n" })
      )
    ).toEqual({
      type: "postMoveConversation",
      delta: 1,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("p", { name: "p" })
      )
    ).toEqual({
      type: "postMoveConversation",
      delta: -1,
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("y", { name: "y" })
      )
    ).toEqual({
      type: "copySelectedBody",
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("r", { name: "r" })
      )
    ).toEqual({
      type: "startReply",
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("w", { name: "w" })
      )
    ).toEqual({
      type: "toggleReplyQuote",
    });

    expect(
      resolveBrowseKeyCommand(
        {
          ...baseState,
          view: "reader" as const,
          conversationItemsLength: 3,
          hasActiveReplyRefs: true,
        },
        key("[", { name: "[" })
      )
    ).toEqual({
      type: "replyRefPrev",
    });

    expect(
      resolveBrowseKeyCommand(
        {
          ...baseState,
          view: "reader" as const,
          conversationItemsLength: 3,
          hasActiveReplyRefs: true,
        },
        key("g", { name: "g" })
      )
    ).toEqual({
      type: "openSelectedReplyRef",
    });

    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "reader" as const, conversationItemsLength: 3 },
        key("X", { name: "X", shift: true })
      )
    ).toEqual({
      type: "copyContextPack",
    });
  });

  it("maps composer shortcuts", () => {
    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "compose-post" as const },
        key("\t", { name: "tab" })
      )
    ).toEqual({
      type: "composePostNextField",
      delta: 1,
    });
    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "compose-post" as const },
        key("s", { name: "s", ctrl: true })
      )
    ).toEqual({
      type: "submitPost",
    });
    expect(
      resolveBrowseKeyCommand(
        { ...baseState, view: "compose-subscription" as const },
        key("\u001B", { name: "escape" })
      )
    ).toEqual({
      type: "composeSubscriptionCancel",
    });
  });
});
