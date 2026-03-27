import { DEFAULT_REPLY_PAGE_SIZE } from "./types.js";
import type {
  BrowseListPost,
  BrowseState,
  Notice,
  PostComposerDraft,
  SubscriptionComposerDraft,
  ViewMode,
} from "./types.js";
import type { ReadPostBundle } from "@/domain/post.js";

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
  initialSearchQuery?: string;
  initialPostComposerDraft: PostComposerDraft;
  initialSubscriptionComposerDraft: SubscriptionComposerDraft;
}): BrowseState {
  return {
    view: "list",
    rawPosts: [],
    selectedIndex: 0,
    listOffset: 0,
    channelSelectedIndex: 0,
    bundle: null,
    replyBody: "",
    replyQuotes: [],
    replyFocusedQuoteId: null,
    replySectionFocus: "editor",
    activeReplyRefIndex: 0,
    loading: true,
    refreshing: false,
    notice: null,
    autoRefreshEnabled: params.initialAutoRefresh,
    lastRefreshAt: "not yet",
    channelFilter: params.initialChannelFilter,
    listDisplayMode: "compact",
    sortMode: "activity",
    themeIndex: 0,
    confirmDelete: null,
    confirmQuit: false,
    confirmDiscardTarget: null,
    focusedReplyIndex: -1,
    postPanelFocus: "index",
    readerMode: false,
    conversationFilterMode: "all",
    conversationSortMode: "thread",
    replyPage: 1,
    replyPageSize: DEFAULT_REPLY_PAGE_SIZE,
    readProgressLabel: "[100% read]",
    showShortcutsHelp: false,
    gotoPageMode: null,
    gotoPageInput: "",
    searchMode: false,
    reactionPickerMode: null,
    reactionPickerSelectedIndex: 0,
    postComposerDraft: params.initialPostComposerDraft,
    postComposerField: "channel",
    subscriptionComposerDraft: params.initialSubscriptionComposerDraft,
    subscriptionComposerField: "mode",
    composerPickerTarget: null,
    composerPickerQuery: "",
    composerPickerSelectedIndex: 0,
    composerPickerPristine: false,
    searchBuilderActive: false,
    searchBuilderField: "tag",
    searchBuilderOperator: "=",
    searchBuilderValue: "",
    searchBuilderSelectedValueIndex: 0,
    searchBuilderSegment: "field",
    searchQuery: params.initialSearchQuery ?? "",
    searchDraftQuery: params.initialSearchQuery ?? "",
    busyOperationKind: null,
    changedPostIds: [],
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
        listOffset: state.listOffset,
        replyBody: "",
        replyQuotes: [],
        replyFocusedQuoteId: null,
        replySectionFocus: "editor",
        activeReplyRefIndex: 0,
        focusedReplyIndex: -1,
        postPanelFocus: "index",
        readerMode: false,
        conversationFilterMode: "all",
        conversationSortMode: "thread",
        replyPage: 1,
        readProgressLabel: "[100% read]",
        notice: null,
        gotoPageMode: null,
        gotoPageInput: "",
        reactionPickerMode: null,
        reactionPickerSelectedIndex: 0,
        postComposerField: "channel",
        subscriptionComposerField: "mode",
        composerPickerTarget: null,
        composerPickerQuery: "",
        composerPickerSelectedIndex: 0,
        composerPickerPristine: false,
        searchBuilderActive: false,
        searchBuilderField: "tag",
        searchBuilderOperator: "=",
        searchBuilderValue: "",
        searchBuilderSelectedValueIndex: 0,
        searchBuilderSegment: "field",
        view: "post",
      };
    case "startReply":
      return {
        ...state,
        replyBody: "",
        gotoPageMode: null,
        gotoPageInput: "",
        reactionPickerMode: null,
        reactionPickerSelectedIndex: 0,
        postComposerField: "channel",
        subscriptionComposerField: "mode",
        composerPickerTarget: null,
        composerPickerQuery: "",
        composerPickerSelectedIndex: 0,
        composerPickerPristine: false,
        searchBuilderActive: false,
        searchBuilderField: "tag",
        searchBuilderOperator: "=",
        searchBuilderValue: "",
        searchBuilderSelectedValueIndex: 0,
        searchBuilderSegment: "field",
        readerMode: false,
        replySectionFocus: "editor",
        activeReplyRefIndex: 0,
        view: "reply",
      };
    case "returnToList":
      return {
        ...state,
        view: "list",
        readerMode: false,
        confirmDelete: null,
        confirmQuit: false,
        confirmDiscardTarget: null,
        showShortcutsHelp: false,
        gotoPageMode: null,
        gotoPageInput: "",
        reactionPickerMode: null,
        reactionPickerSelectedIndex: 0,
        postComposerField: "channel",
        subscriptionComposerField: "mode",
        composerPickerTarget: null,
        composerPickerQuery: "",
        composerPickerSelectedIndex: 0,
        composerPickerPristine: false,
        searchBuilderActive: false,
        searchBuilderField: "tag",
        searchBuilderOperator: "=",
        searchBuilderValue: "",
        searchBuilderSelectedValueIndex: 0,
        searchBuilderSegment: "field",
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

export function resetConversationState(): Pick<
  BrowseState,
  | "focusedReplyIndex"
  | "postPanelFocus"
  | "conversationFilterMode"
  | "conversationSortMode"
  | "readProgressLabel"
> {
  return {
    focusedReplyIndex: -1,
    postPanelFocus: "index",
    conversationFilterMode: "all",
    conversationSortMode: "thread",
    readProgressLabel: "[100% read]",
  };
}

export function resolveDeleteTransition(params: {
  currentBundle: ReadPostBundle | null;
  currentView: ViewMode;
  currentFocusedId: string | null;
  deletedPostId: string;
}): { bundle: ReadPostBundle | null; view: ViewMode; focusedId: string | null } {
  const shouldCloseBundle = params.currentBundle?.post.id === params.deletedPostId;

  return {
    bundle: shouldCloseBundle ? null : params.currentBundle,
    view: shouldCloseBundle ? "list" : params.currentView,
    focusedId: params.currentFocusedId === params.deletedPostId ? null : params.currentFocusedId,
  };
}
