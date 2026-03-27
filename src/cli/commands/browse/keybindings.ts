import type { KeyLike, ViewMode } from "./types.js";

export type BrowseKeyState = {
  view: ViewMode;
  readerMode: boolean;
  showShortcutsHelp: boolean;
  confirmDelete: boolean;
  confirmQuit: boolean;
  confirmDiscard: boolean;
  gotoPageMode: "list" | "thread" | null;
  searchMode: boolean;
  reactionPickerMode: "post" | "reply" | null;
  searchBuilderActive: boolean;
  busyOperationKind: "search" | "refresh" | "submit-post" | "submit-subscription" | null;
  hasActiveSearch: boolean;
  replyBody: string;
  replySectionFocus: "quotes" | "preview" | "editor";
  postPanelFocus: "index" | "content";
  conversationFilterMode: "all" | "original" | "replies";
  focusedReplyIndex: number;
  canQuoteReply: boolean;
  hasSelectedPost: boolean;
  hasBundle: boolean;
  hasRefPost: boolean;
  hasActiveReplyRefs: boolean;
  channelSelectedIndex: number;
  channelCount: number;
  postsLength: number;
  selectedConversationIndex: number;
  conversationItemsLength: number;
  composeFieldKind: "text" | "multiline" | "enum" | null;
  composeFieldSupportsPicker: boolean;
  composePickerOpen: boolean;
  composeSuggestionCount: number;
};

export type BrowseKeyCommand =
  | { type: "terminate" }
  | { type: "noop" }
  | { type: "closeShortcuts" }
  | { type: "scrollShortcuts"; delta: number }
  | { type: "confirmDelete" }
  | { type: "cancelDelete" }
  | { type: "closeGotoPage" }
  | { type: "applyGotoPage" }
  | { type: "cancelBusyOperation" }
  | { type: "closeReactionPicker" }
  | { type: "openReactionPicker" }
  | { type: "reactionMove"; delta: number }
  | { type: "applyReaction"; index?: number }
  | { type: "closeSearch" }
  | { type: "openSearchBuilder" }
  | { type: "closeSearchBuilder" }
  | { type: "searchBuilderSegment"; delta: 1 | -1 }
  | { type: "searchBuilderCycle"; delta: 1 | -1 }
  | { type: "searchBuilderBackspace" }
  | { type: "applySearchBuilder" }
  | { type: "applySearch" }
  | { type: "searchComplete"; direction: 1 | -1 }
  | { type: "searchBackspace" }
  | { type: "replyCancel" }
  | { type: "clearReplyQuotes" }
  | { type: "replyFocusNext" }
  | { type: "replyFocusPrev" }
  | { type: "replyMoveQuoteSelection"; delta: number }
  | { type: "replyPreviewScroll"; delta: number }
  | { type: "copyReplyDraft" }
  | { type: "submitReply" }
  | { type: "composePostCancel" }
  | { type: "composePostNextField"; delta: 1 | -1 }
  | { type: "composePostCycleOption"; delta: 1 | -1 }
  | { type: "composeOpenPicker" }
  | { type: "composeClosePicker" }
  | { type: "composeMovePicker"; delta: number }
  | { type: "composeApplyPicker"; index?: number }
  | { type: "submitPost" }
  | { type: "composeSubscriptionCancel" }
  | { type: "composeSubscriptionNextField"; delta: 1 | -1 }
  | { type: "composeSubscriptionCycleOption"; delta: 1 | -1 }
  | { type: "submitSubscription" }
  | { type: "quit" }
  | { type: "cancelQuit" }
  | { type: "confirmDiscard" }
  | { type: "cancelDiscard" }
  | { type: "toggleShortcuts" }
  | { type: "cycleTheme" }
  | { type: "toggleAutoRefresh" }
  | { type: "cycleListDisplayMode" }
  | { type: "manualRefresh" }
  | { type: "channelsMove"; delta: number }
  | { type: "channelsSelect" }
  | { type: "channelsBack" }
  | { type: "cycleChannelFilter" }
  | { type: "cycleSortMode" }
  | { type: "listMove"; delta: number }
  | { type: "listPagePrev" }
  | { type: "listPageNext" }
  | { type: "openSelectedPost" }
  | { type: "deleteSelectedPost" }
  | { type: "openChannels" }
  | { type: "openSearch" }
  | { type: "clearSearch" }
  | { type: "openGotoPage"; mode: "list" | "thread" }
  | { type: "openReader" }
  | { type: "closeReader" }
  | { type: "postFocus"; focus: "index" | "content" }
  | { type: "postMoveConversation"; delta: number }
  | { type: "postPagePrev" }
  | { type: "postPageNext" }
  | { type: "postScroll"; delta: number }
  | { type: "readerScroll"; delta: number }
  | { type: "copySelectedBody" }
  | { type: "copyContextPack" }
  | { type: "openReferencedPost" }
  | { type: "replyRefPrev" }
  | { type: "replyRefNext" }
  | { type: "openSelectedReplyRef" }
  | { type: "cycleConversationFilter" }
  | { type: "cycleConversationSort" }
  | { type: "deleteCurrentThread" }
  | { type: "backFromPost" }
  | { type: "startReply" }
  | { type: "toggleReplyQuote" }
  | { type: "openPostComposer" }
  | { type: "openSubscriptionComposer" };

export function resolveBrowseKeyCommand(state: BrowseKeyState, key: KeyLike): BrowseKeyCommand {
  if (isCtrlKey(key, "c")) {
    return { type: "terminate" };
  }

  if (state.confirmQuit) {
    if (isEscapeKey(key)) {
      return { type: "cancelQuit" };
    }
    if (isCharacterKey(key, "q")) {
      return { type: "quit" };
    }
    return { type: "cancelQuit" };
  }

  if (state.confirmDiscard) {
    if (isEscapeKey(key)) {
      return { type: "confirmDiscard" };
    }
    return { type: "cancelDiscard" };
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

  if (state.reactionPickerMode) {
    if (isEscapeKey(key)) {
      return { type: "closeReactionPicker" };
    }
    if (isEnterKey(key)) {
      return { type: "applyReaction" };
    }
    if (isUpKey(key) || isCharacterKey(key, "k")) {
      return { type: "reactionMove", delta: -1 };
    }
    if (isDownKey(key) || isCharacterKey(key, "j")) {
      return { type: "reactionMove", delta: 1 };
    }
    const quickPickIndex = getDigitQuickPickIndex(key);
    if (quickPickIndex != null) {
      return { type: "applyReaction", index: quickPickIndex };
    }
    return { type: "noop" };
  }

  if (state.composePickerOpen) {
    if (isEscapeKey(key)) {
      return { type: "composeClosePicker" };
    }
    if (isEnterKey(key)) {
      return { type: "composeApplyPicker" };
    }
    if (isUpKey(key) || isCharacterKey(key, "k")) {
      return { type: "composeMovePicker", delta: -1 };
    }
    if (isDownKey(key) || isCharacterKey(key, "j")) {
      return { type: "composeMovePicker", delta: 1 };
    }
    if (isPgUpKey(key)) {
      return {
        type: "composeMovePicker",
        delta: -Math.max(1, state.composeSuggestionCount),
      };
    }
    if (isPgDownKey(key)) {
      return {
        type: "composeMovePicker",
        delta: Math.max(1, state.composeSuggestionCount),
      };
    }
    const quickPickIndex = getDigitQuickPickIndex(key);
    if (quickPickIndex != null && quickPickIndex < state.composeSuggestionCount) {
      return { type: "composeApplyPicker", index: quickPickIndex };
    }
    return { type: "noop" };
  }

  if (state.busyOperationKind) {
    if (isEscapeKey(key)) {
      return { type: "cancelBusyOperation" };
    }
  }

  if (state.gotoPageMode) {
    if (isEscapeKey(key)) {
      return { type: "closeGotoPage" };
    }
    if (isEnterKey(key)) {
      return { type: "applyGotoPage" };
    }
    return { type: "noop" };
  }

  if (state.searchMode) {
    if (state.searchBuilderActive) {
      if (isEscapeKey(key)) {
        return { type: "closeSearchBuilder" };
      }
      if (isEnterKey(key)) {
        return { type: "applySearchBuilder" };
      }
      if (isLeftKey(key) || isShiftTabKey(key)) {
        return { type: "searchBuilderSegment", delta: -1 };
      }
      if (isRightKey(key) || isTabKey(key)) {
        return { type: "searchBuilderSegment", delta: 1 };
      }
      if (isUpKey(key) || isCharacterKey(key, "k")) {
        return { type: "searchBuilderCycle", delta: -1 };
      }
      if (isDownKey(key) || isCharacterKey(key, "j")) {
        return { type: "searchBuilderCycle", delta: 1 };
      }
      if (isBackspaceKey(key)) {
        return { type: "searchBuilderBackspace" };
      }
      return { type: "noop" };
    }

    if (isCharacterKey(key, "/")) {
      return { type: "openSearchBuilder" };
    }
    if (isEscapeKey(key)) {
      return { type: "closeSearch" };
    }
    if (isEnterKey(key)) {
      return { type: "applySearch" };
    }
    if (isShiftTabKey(key)) {
      return { type: "searchComplete", direction: -1 };
    }
    if (isTabKey(key)) {
      return { type: "searchComplete", direction: 1 };
    }
    if (isBackspaceKey(key)) {
      return { type: "searchBackspace" };
    }
    return { type: "noop" };
  }

  if (state.view === "reply") {
    if (isEscapeKey(key)) {
      return { type: "replyCancel" };
    }
    if (isShiftTabKey(key)) {
      return { type: "replyFocusPrev" };
    }
    if (isTabKey(key)) {
      return { type: "replyFocusNext" };
    }
    if (isCtrlKey(key, "k")) {
      return { type: "clearReplyQuotes" };
    }
    if (isCtrlKey(key, "y") && state.replyBody.trim()) {
      return { type: "copyReplyDraft" };
    }
    if (isCtrlKey(key, "s")) {
      return { type: "submitReply" };
    }
    if (
      state.replySectionFocus === "quotes" &&
      (isUpKey(key) ||
        isDownKey(key) ||
        isCharacterKey(key, "k") ||
        isCharacterKey(key, "j") ||
        isPgUpKey(key) ||
        isPgDownKey(key))
    ) {
      return {
        type: "replyMoveQuoteSelection",
        delta:
          isUpKey(key) || isCharacterKey(key, "k")
            ? -1
            : isPgUpKey(key)
              ? -5
              : isPgDownKey(key)
                ? 5
                : 1,
      };
    }
    if (
      state.replySectionFocus === "preview" &&
      (isUpKey(key) || isPgUpKey(key) || isDownKey(key) || isPgDownKey(key))
    ) {
      return {
        type: "replyPreviewScroll",
        delta: isUpKey(key) ? -3 : isPgUpKey(key) ? -12 : isDownKey(key) ? 3 : 12,
      };
    }
    return { type: "noop" };
  }

  if (state.view === "compose-post") {
    if (isEscapeKey(key)) {
      return { type: "composePostCancel" };
    }
    if (state.composeFieldSupportsPicker && isEnterKey(key)) {
      return { type: "composeOpenPicker" };
    }
    if (state.composeFieldKind === "enum" && isLeftKey(key)) {
      return { type: "composePostCycleOption", delta: -1 };
    }
    if (state.composeFieldKind === "enum" && isRightKey(key)) {
      return { type: "composePostCycleOption", delta: 1 };
    }
    if (isShiftTabKey(key)) {
      return { type: "composePostNextField", delta: -1 };
    }
    if (isTabKey(key)) {
      return { type: "composePostNextField", delta: 1 };
    }
    if (isCtrlKey(key, "s")) {
      return { type: "submitPost" };
    }
    return { type: "noop" };
  }

  if (state.view === "compose-subscription") {
    if (isEscapeKey(key)) {
      return { type: "composeSubscriptionCancel" };
    }
    if (state.composeFieldSupportsPicker && isEnterKey(key)) {
      return { type: "composeOpenPicker" };
    }
    if (state.composeFieldKind === "enum" && isLeftKey(key)) {
      return { type: "composeSubscriptionCycleOption", delta: -1 };
    }
    if (state.composeFieldKind === "enum" && isRightKey(key)) {
      return { type: "composeSubscriptionCycleOption", delta: 1 };
    }
    if (isShiftTabKey(key)) {
      return { type: "composeSubscriptionNextField", delta: -1 };
    }
    if (isTabKey(key)) {
      return { type: "composeSubscriptionNextField", delta: 1 };
    }
    if (isCtrlKey(key, "s")) {
      return { type: "submitSubscription" };
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
  if (isCharacterKey(key, "v")) {
    return { type: "cycleListDisplayMode" };
  }
  if (isCharacterKey(key, "u")) {
    return { type: "manualRefresh" };
  }

  if (state.view === "channels") {
    if (isCharacterKey(key, "n")) {
      return { type: "openPostComposer" };
    }
    if (isCharacterKey(key, "s")) {
      return { type: "openSubscriptionComposer" };
    }
    if (isUpKey(key)) {
      return { type: "channelsMove", delta: -1 };
    }
    if (isDownKey(key)) {
      return { type: "channelsMove", delta: 1 };
    }
    if (isEnterKey(key)) {
      return { type: "channelsSelect" };
    }
    if (isTabKey(key) || isEscapeKey(key)) {
      return { type: "channelsBack" };
    }
    return { type: "noop" };
  }

  if (state.view === "list") {
    if (isCharacterKey(key, "n")) {
      return { type: "openPostComposer" };
    }
    if (isCharacterKey(key, "c")) {
      return { type: "cycleChannelFilter" };
    }
    if (isCharacterKey(key, "o")) {
      return { type: "cycleSortMode" };
    }
    if (isCharacterKey(key, "/")) {
      return { type: "openSearch" };
    }
    if (isPgUpKey(key)) {
      return { type: "listPagePrev" };
    }
    if (isPgDownKey(key)) {
      return { type: "listPageNext" };
    }
    if (isCharacterKey(key, "[")) {
      return { type: "listPagePrev" };
    }
    if (isCharacterKey(key, "]")) {
      return { type: "listPageNext" };
    }
    if (isShiftCharacterKey(key, "G")) {
      return { type: "openGotoPage", mode: "list" };
    }
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
    if (isEscapeKey(key)) {
      return state.hasActiveSearch ? { type: "clearSearch" } : { type: "openChannels" };
    }
    return { type: "noop" };
  }

  if (state.view === "post") {
    if (isCharacterKey(key, "n")) {
      return { type: "openPostComposer" };
    }
    if (isCharacterKey(key, "s")) {
      return { type: "openSubscriptionComposer" };
    }
    if (isEnterKey(key) && state.hasBundle) {
      return { type: "openReader" };
    }
    if (isPgUpKey(key)) {
      return { type: "postScroll", delta: -12 };
    }
    if (isPgDownKey(key)) {
      return { type: "postScroll", delta: 12 };
    }
    if (isShiftCharacterKey(key, "G")) {
      return { type: "openGotoPage", mode: "thread" };
    }
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
    if (isCharacterKey(key, "y") && state.hasBundle) {
      return { type: "copySelectedBody" };
    }
    if (isCharacterKey(key, "x") && state.hasBundle) {
      return { type: "copyContextPack" };
    }
    if (isShiftCharacterKey(key, "X") && state.hasBundle) {
      return { type: "copyContextPack" };
    }
    if (isCharacterKey(key, "g") && state.hasActiveReplyRefs) {
      return { type: "openSelectedReplyRef" };
    }
    if (isCharacterKey(key, "g") && state.hasRefPost) {
      return { type: "openReferencedPost" };
    }
    if (isCharacterKey(key, "[")) {
      return { type: "replyRefPrev" };
    }
    if (isCharacterKey(key, "]")) {
      return { type: "replyRefNext" };
    }
    if (isCharacterKey(key, "f")) {
      return { type: "cycleConversationFilter" };
    }
    if (isCharacterKey(key, "s")) {
      return { type: "cycleConversationSort" };
    }
    if (isCharacterKey(key, "o")) {
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
    if ((isCharacterKey(key, "e") || isShiftCharacterKey(key, "R")) && state.hasBundle) {
      return { type: "openReactionPicker" };
    }
    if (isCharacterKey(key, "w") && state.hasBundle) {
      return { type: "toggleReplyQuote" };
    }
    if (isShiftCharacterKey(key, "Q") && state.hasBundle) {
      return { type: "toggleReplyQuote" };
    }
  }

  if (state.view === "reader") {
    if (isCharacterKey(key, "s")) {
      return { type: "openSubscriptionComposer" };
    }
    if (isEscapeKey(key) || isCharacterKey(key, "b")) {
      return { type: "closeReader" };
    }
    if (isCharacterKey(key, "y") && state.hasBundle) {
      return { type: "copySelectedBody" };
    }
    if (isCharacterKey(key, "x") && state.hasBundle) {
      return { type: "copyContextPack" };
    }
    if (isShiftCharacterKey(key, "X") && state.hasBundle) {
      return { type: "copyContextPack" };
    }
    if (isCharacterKey(key, "s") || isCharacterKey(key, "o")) {
      return { type: "cycleConversationSort" };
    }
    if (isCharacterKey(key, "g") && state.hasActiveReplyRefs) {
      return { type: "openSelectedReplyRef" };
    }
    if (isCharacterKey(key, "[")) {
      return { type: "replyRefPrev" };
    }
    if (isCharacterKey(key, "]")) {
      return { type: "replyRefNext" };
    }
    if (isCharacterKey(key, "g") && state.hasBundle) {
      return { type: "openSelectedReplyRef" };
    }
    if (isCharacterKey(key, "r") && state.hasBundle) {
      return { type: "startReply" };
    }
    if ((isCharacterKey(key, "e") || isShiftCharacterKey(key, "R")) && state.hasBundle) {
      return { type: "openReactionPicker" };
    }
    if (isCharacterKey(key, "w") && state.hasBundle) {
      return { type: "toggleReplyQuote" };
    }
    if (isShiftCharacterKey(key, "Q") && state.hasBundle) {
      return { type: "toggleReplyQuote" };
    }
    if (isCharacterKey(key, "k") || isCharacterKey(key, "p")) {
      return { type: "postMoveConversation", delta: -1 };
    }
    if (isCharacterKey(key, "j") || isCharacterKey(key, "n")) {
      return { type: "postMoveConversation", delta: 1 };
    }
    if (isUpKey(key)) {
      return { type: "readerScroll", delta: -3 };
    }
    if (isDownKey(key)) {
      return { type: "readerScroll", delta: 3 };
    }
    if (isPgUpKey(key)) {
      return { type: "readerScroll", delta: -12 };
    }
    if (isPgDownKey(key)) {
      return { type: "readerScroll", delta: 12 };
    }
    return { type: "noop" };
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
  return (
    key.name === "enter" || key.name === "return" || key.sequence === "\r" || key.sequence === "\n"
  );
}

export function isEscapeKey(key: KeyLike): boolean {
  return key.name === "escape" || key.sequence === "\u001B";
}

export function isTabKey(key: KeyLike): boolean {
  return key.name === "tab" || key.sequence === "\t";
}

export function isShiftTabKey(key: KeyLike): boolean {
  return (key.shift && key.name === "tab") || key.name === "backtab" || key.sequence === "\u001B[Z";
}

export function isPgUpKey(key: KeyLike): boolean {
  return key.name === "pgup" || key.name === "pageup" || key.sequence === "\u001B[5~";
}

export function isPgDownKey(key: KeyLike): boolean {
  return key.name === "pgdn" || key.name === "pagedown" || key.sequence === "\u001B[6~";
}

export function isBackspaceKey(key: KeyLike): boolean {
  return key.name === "backspace" || key.sequence === "\u007F" || key.sequence === "\b";
}

export function isCharacterKey(key: KeyLike, value: string): boolean {
  if (key.ctrl || key.alt || key.meta) {
    return false;
  }

  if (key.sequence.length === 1) {
    return key.sequence === value;
  }

  return key.name === value || key.sequence === value;
}

export function isShiftCharacterKey(key: KeyLike, value: string): boolean {
  if (key.ctrl || key.alt || key.meta) {
    return false;
  }

  const normalized = value.toLowerCase();
  const keyName = key.name.toLowerCase();
  const keySequence = key.sequence.toLowerCase();

  return (
    (key.shift && (keyName === normalized || keySequence === normalized)) ||
    key.name === value ||
    key.sequence === value
  );
}

export function isCtrlKey(key: KeyLike, value: string): boolean {
  return key.ctrl && (key.name === value || key.sequence.toLowerCase() === value.toLowerCase());
}

function getDigitQuickPickIndex(key: KeyLike): number | null {
  if (key.ctrl || key.alt || key.meta) {
    return null;
  }

  const raw = key.sequence.length === 1 ? key.sequence : key.name;
  if (!/^[1-9]$/.test(raw)) {
    return null;
  }

  return Number(raw) - 1;
}
