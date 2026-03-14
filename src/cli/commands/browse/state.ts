import type { BrowseListPost, BrowseSortMode, BrowseState, ConversationFilterMode, ConversationSortMode, Notice, PanelFocus, ViewMode } from "./types.js";
import type { ReadPostBundle } from "../../../domain/post.js";

type StatePatch = Partial<BrowseState>;

export type BrowseAction =
  | { type: "patch"; patch: StatePatch }
  | { type: "setView"; view: ViewMode }
  | { type: "openBundle"; bundle: ReadPostBundle }
  | { type: "startReply" }
  | { type: "returnToList" }
  | { type: "setNotice"; notice: Notice }
  | { type: "confirmDelete"; post: BrowseListPost | null }
  | { type: "setReplyBody"; value: string };

export function createInitialBrowseState(params: {
  initialChannelFilter: string;
  initialAutoRefresh: boolean;
}): BrowseState {
  return {
    view: "list",
    rawPosts: [],
    selectedIndex: 0,
    channelSelectedIndex: 0,
    bundle: null,
    replyBody: "",
    loading: true,
    refreshing: false,
    notice: null,
    autoRefreshEnabled: params.initialAutoRefresh,
    lastRefreshAt: "not yet",
    channelFilter: params.initialChannelFilter,
    sortMode: "activity",
    themeIndex: 0,
    confirmDelete: null,
    focusedReplyIndex: -1,
    postPanelFocus: "index",
    conversationFilterMode: "all",
    conversationSortMode: "thread",
    readProgressLabel: "[100% read]",
    showShortcutsHelp: false
  };
}

export function browseReducer(state: BrowseState, action: BrowseAction): BrowseState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "setView":
      return { ...state, view: action.view };
    case "openBundle":
      return {
        ...state,
        bundle: action.bundle,
        replyBody: "",
        focusedReplyIndex: -1,
        postPanelFocus: "index",
        conversationFilterMode: "all",
        conversationSortMode: "thread",
        readProgressLabel: "[100% read]",
        notice: null,
        view: "post"
      };
    case "startReply":
      return {
        ...state,
        replyBody: "",
        view: "reply"
      };
    case "returnToList":
      return {
        ...state,
        view: "list",
        confirmDelete: null,
        showShortcutsHelp: false
      };
    case "setNotice":
      return { ...state, notice: action.notice };
    case "confirmDelete":
      return { ...state, confirmDelete: action.post };
    case "setReplyBody":
      return { ...state, replyBody: action.value };
  }
}

export function cycleThemeIndex(currentIndex: number, themeCount: number): number {
  return (currentIndex + 1) % themeCount;
}

export function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.max(0, Math.min(length - 1, index));
}

export function resetConversationState(): Pick<BrowseState, "focusedReplyIndex" | "postPanelFocus" | "conversationFilterMode" | "conversationSortMode" | "readProgressLabel"> {
  return {
    focusedReplyIndex: -1,
    postPanelFocus: "index",
    conversationFilterMode: "all",
    conversationSortMode: "thread",
    readProgressLabel: "[100% read]"
  };
}
