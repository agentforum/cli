import type { KeyLike, ViewMode } from "./types.js";

export type BrowseKeyState = {
  view: ViewMode;
  showShortcutsHelp: boolean;
  confirmDelete: boolean;
  replyBody: string;
  postPanelFocus: "index" | "content";
  conversationFilterMode: "all" | "original" | "replies";
  focusedReplyIndex: number;
  hasSelectedPost: boolean;
  hasBundle: boolean;
  hasRefPost: boolean;
  channelSelectedIndex: number;
  channelCount: number;
  postsLength: number;
  selectedConversationIndex: number;
  conversationItemsLength: number;
};

export type BrowseKeyCommand =
  | { type: "terminate" }
  | { type: "noop" }
  | { type: "closeShortcuts" }
  | { type: "scrollShortcuts"; delta: number }
  | { type: "confirmDelete" }
  | { type: "cancelDelete" }
  | { type: "replyCancel" }
  | { type: "copyReplyDraft" }
  | { type: "submitReply" }
  | { type: "quit" }
  | { type: "toggleShortcuts" }
  | { type: "cycleTheme" }
  | { type: "toggleAutoRefresh" }
  | { type: "manualRefresh" }
  | { type: "channelsMove"; delta: number }
  | { type: "channelsSelect" }
  | { type: "channelsBack" }
  | { type: "cycleChannelFilter" }
  | { type: "cycleSortMode" }
  | { type: "listMove"; delta: number }
  | { type: "openSelectedPost" }
  | { type: "deleteSelectedPost" }
  | { type: "openChannels" }
  | { type: "postFocus"; focus: "index" | "content" }
  | { type: "postMoveConversation"; delta: number }
  | { type: "postScroll"; delta: number }
  | { type: "copySelectedBody" }
  | { type: "openReferencedPost" }
  | { type: "cycleConversationFilter" }
  | { type: "cycleConversationSort" }
  | { type: "deleteCurrentThread" }
  | { type: "backFromPost" }
  | { type: "startReply" };

export function resolveBrowseKeyCommand(state: BrowseKeyState, key: KeyLike): BrowseKeyCommand {
  if (isCtrlKey(key, "c")) {
    return { type: "terminate" };
  }

  if (state.showShortcutsHelp) {
    if (isEscapeKey(key) || isCharacterKey(key, "?")) {
      return { type: "closeShortcuts" };
    }
    if (isUpKey(key)) {
      return { type: "scrollShortcuts", delta: -3 };
    }
    if (isDownKey(key)) {
      return { type: "scrollShortcuts", delta: 3 };
    }
    if (isPgUpKey(key)) {
      return { type: "scrollShortcuts", delta: -10 };
    }
    if (isPgDownKey(key)) {
      return { type: "scrollShortcuts", delta: 10 };
    }
    return { type: "noop" };
  }

  if (state.confirmDelete) {
    if (isCharacterKey(key, "y")) {
      return { type: "confirmDelete" };
    }
    return { type: "cancelDelete" };
  }

  if (state.view === "reply") {
    if (isEscapeKey(key)) {
      return { type: "replyCancel" };
    }
    if (isCtrlKey(key, "y") && state.replyBody.trim()) {
      return { type: "copyReplyDraft" };
    }
    if ((key.ctrl && isEnterKey(key)) || isCtrlKey(key, "s")) {
      return { type: "submitReply" };
    }
    return { type: "noop" };
  }

  if (isCharacterKey(key, "q")) {
    return { type: "quit" };
  }
  if (isCharacterKey(key, "?")) {
    return { type: "toggleShortcuts" };
  }
  if (isCharacterKey(key, "t")) {
    return { type: "cycleTheme" };
  }
  if (isCharacterKey(key, "a")) {
    return { type: "toggleAutoRefresh" };
  }
  if (isCharacterKey(key, "u")) {
    return { type: "manualRefresh" };
  }

  if (state.view === "channels") {
    if (isUpKey(key)) {
      return { type: "channelsMove", delta: -1 };
    }
    if (isDownKey(key)) {
      return { type: "channelsMove", delta: 1 };
    }
    if (isEnterKey(key)) {
      return { type: "channelsSelect" };
    }
    if (isTabKey(key)) {
      return { type: "channelsBack" };
    }
    return { type: "noop" };
  }

  if (isCharacterKey(key, "c")) {
    return { type: "cycleChannelFilter" };
  }
  if (isCharacterKey(key, "o")) {
    return { type: "cycleSortMode" };
  }

  if (state.view === "list") {
    if (isUpKey(key)) {
      return { type: "listMove", delta: -1 };
    }
    if (isDownKey(key)) {
      return { type: "listMove", delta: 1 };
    }
    if (isEnterKey(key) && state.hasSelectedPost) {
      return { type: "openSelectedPost" };
    }
    if (isCharacterKey(key, "d") && state.hasSelectedPost) {
      return { type: "deleteSelectedPost" };
    }
    if (isTabKey(key)) {
      return { type: "openChannels" };
    }
    return { type: "noop" };
  }

  if (state.view === "post") {
    if (isLeftKey(key)) {
      return { type: "postFocus", focus: "index" };
    }
    if (isRightKey(key)) {
      return { type: "postFocus", focus: "content" };
    }
    if (isUpKey(key)) {
      return state.postPanelFocus === "index"
        ? { type: "postMoveConversation", delta: -1 }
        : { type: "postScroll", delta: -3 };
    }
    if (isDownKey(key)) {
      return state.postPanelFocus === "index"
        ? { type: "postMoveConversation", delta: 1 }
        : { type: "postScroll", delta: 3 };
    }
    if (isPgUpKey(key)) {
      return { type: "postMoveConversation", delta: -1 };
    }
    if (isPgDownKey(key)) {
      return { type: "postMoveConversation", delta: 1 };
    }
    if (isCharacterKey(key, "y") && state.hasBundle) {
      return { type: "copySelectedBody" };
    }
    if (isCharacterKey(key, "g") && state.hasRefPost) {
      return { type: "openReferencedPost" };
    }
    if (isCharacterKey(key, "f")) {
      return { type: "cycleConversationFilter" };
    }
    if (isCharacterKey(key, "s")) {
      return { type: "cycleConversationSort" };
    }
    if (isCharacterKey(key, "d") && state.hasBundle) {
      return { type: "deleteCurrentThread" };
    }
    if (isCharacterKey(key, "b") || isEscapeKey(key)) {
      return { type: "backFromPost" };
    }
    if (isCharacterKey(key, "r")) {
      return { type: "startReply" };
    }
  }

  return { type: "noop" };
}

export function isUpKey(key: KeyLike): boolean {
  return key.name === "up" || key.sequence === "\u001B[A";
}

export function isDownKey(key: KeyLike): boolean {
  return key.name === "down" || key.sequence === "\u001B[B";
}

export function isLeftKey(key: KeyLike): boolean {
  return key.name === "left" || key.sequence === "\u001B[D";
}

export function isRightKey(key: KeyLike): boolean {
  return key.name === "right" || key.sequence === "\u001B[C";
}

export function isEnterKey(key: KeyLike): boolean {
  return key.name === "enter" || key.name === "return" || key.sequence === "\r" || key.sequence === "\n";
}

export function isEscapeKey(key: KeyLike): boolean {
  return key.name === "escape" || key.sequence === "\u001B";
}

export function isTabKey(key: KeyLike): boolean {
  return key.name === "tab" || key.sequence === "\t";
}

export function isPgUpKey(key: KeyLike): boolean {
  return key.name === "pgup" || key.name === "pageup" || key.sequence === "\u001B[5~";
}

export function isPgDownKey(key: KeyLike): boolean {
  return key.name === "pgdn" || key.name === "pagedown" || key.sequence === "\u001B[6~";
}

export function isCharacterKey(key: KeyLike, value: string): boolean {
  return !key.ctrl && !key.alt && !key.meta && (key.name === value || key.sequence === value);
}

export function isCtrlKey(key: KeyLike, value: string): boolean {
  return key.ctrl && (key.name === value || key.sequence.toLowerCase() === value.toLowerCase());
}
