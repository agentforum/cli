import { describe, expect, it } from "vitest";

import { resolveBrowseKeyCommand } from "../../src/cli/commands/browse/keybindings.js";

const baseState = {
  view: "list" as const,
  showShortcutsHelp: false,
  confirmDelete: false,
  replyBody: "",
  postPanelFocus: "index" as const,
  conversationFilterMode: "all" as const,
  focusedReplyIndex: -1,
  hasSelectedPost: true,
  hasBundle: true,
  hasRefPost: false,
  channelSelectedIndex: 0,
  channelCount: 3,
  postsLength: 2,
  selectedConversationIndex: 0,
  conversationItemsLength: 2
};

function key(sequence: string, overrides: Partial<{ name: string; ctrl: boolean; alt: boolean; meta: boolean; shift: boolean }> = {}) {
  return {
    name: overrides.name ?? sequence,
    sequence,
    ctrl: overrides.ctrl ?? false,
    alt: overrides.alt ?? false,
    meta: overrides.meta ?? false,
    shift: overrides.shift ?? false
  };
}

describe("browse keybindings", () => {
  it("maps global shortcuts", () => {
    expect(resolveBrowseKeyCommand(baseState, key("?", { name: "?" }))).toEqual({ type: "toggleShortcuts" });
    expect(resolveBrowseKeyCommand(baseState, key("t", { name: "t" }))).toEqual({ type: "cycleTheme" });
    expect(resolveBrowseKeyCommand(baseState, key("u", { name: "u" }))).toEqual({ type: "manualRefresh" });
  });

  it("maps list navigation and selection", () => {
    expect(resolveBrowseKeyCommand(baseState, key("\u001B[A", { name: "up" }))).toEqual({ type: "listMove", delta: -1 });
    expect(resolveBrowseKeyCommand(baseState, key("\u001B[B", { name: "down" }))).toEqual({ type: "listMove", delta: 1 });
    expect(resolveBrowseKeyCommand(baseState, key("\r", { name: "enter" }))).toEqual({ type: "openSelectedPost" });
  });

  it("maps reply-mode commands", () => {
    const replyState = { ...baseState, view: "reply" as const, replyBody: "draft" };
    expect(resolveBrowseKeyCommand(replyState, key("\u001B", { name: "escape" }))).toEqual({ type: "replyCancel" });
    expect(resolveBrowseKeyCommand(replyState, key("y", { name: "y", ctrl: true }))).toEqual({ type: "copyReplyDraft" });
    expect(resolveBrowseKeyCommand(replyState, key("\r", { name: "enter", ctrl: true }))).toEqual({ type: "submitReply" });
  });

  it("maps post-view commands", () => {
    const postState = { ...baseState, view: "post" as const, hasRefPost: true };
    expect(resolveBrowseKeyCommand(postState, key("r", { name: "r" }))).toEqual({ type: "startReply" });
    expect(resolveBrowseKeyCommand(postState, key("g", { name: "g" }))).toEqual({ type: "openReferencedPost" });
    expect(resolveBrowseKeyCommand(postState, key("\u001B[C", { name: "right" }))).toEqual({ type: "postFocus", focus: "content" });
  });
});
