import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { TermElement, TermInput } from "terminosaurus";
import { useScreen } from "terminosaurus/react";
import pkg from "../../../../package.json" with { type: "json" };

import {
  SEARCH_BUILDER_FIELDS,
  buildSearchBuilderToken,
  cycleSearchBuilderField,
  cycleSearchBuilderOperator,
  getSearchValueSuggestions,
  getSearchBuilderValueSuggestions,
  cycleSearchValueSuggestion,
  cycleSearchQualifierSuggestion,
  hasSearchValueToken,
  parseStructuredSearchQuery,
} from "@/cli/search-query.js";
import { POST_STATUSES, SEVERITIES, type ReadPostBundle } from "@/domain/post.js";
import type {
  BrowseAppProps,
  BrowseListPost,
  BrowseRelationSummary,
  BrowseSortMode,
  KeyLike,
  PostComposerField,
  ReplyQuote,
  SubscriptionComposerField,
} from "./types.js";
import {
  ALL_CHANNELS,
  CONVERSATION_FILTER_MODES,
  CONVERSATION_SORT_MODES,
  getPostComposerFieldKind,
  getSubscriptionComposerFieldKind,
  getVisiblePostComposerFields,
  LIST_DISPLAY_MODES,
  SORT_MODES,
  SUBSCRIPTION_COMPOSER_FIELDS,
} from "./types.js";
import { BrowseScreen } from "./components/BrowseScreen.js";
import { copyContextPack, copyToClipboard } from "./clipboard.js";
import {
  buildInitialPostComposerDraft,
  buildInitialSubscriptionComposerDraft,
  refreshBrowseData,
  submitBrowsePost,
  submitBrowseReply,
  submitBrowseSubscription,
} from "./data.js";
import { buildReadProgressLabel, formatRefreshClock, toMessage } from "./formatters.js";
import { resolveBrowseKeyCommand } from "./keybindings.js";
import {
  applyPostComposerSuggestion,
  applySubscriptionComposerSuggestion,
  buildPostComposerPickerItems,
  buildPostComposerSuggestionLookup,
  buildSubscriptionComposerPickerItems,
  buildSubscriptionComposerSuggestionLookup,
  isPostComposerDynamicPickerField,
  isPostComposerPickerField,
  isSubscriptionComposerDynamicPickerField,
  isSubscriptionComposerPickerField,
} from "./composer-suggestions.js";
import {
  MAX_SEARCH_QUERY_LENGTH,
  appendSearchQuery,
  clampCursorIndex,
  consumeOpenSearchShortcut,
  deleteInputTextBackward,
  deleteSearchQueryBackward,
  insertInputTextAtCursor,
  moveInputCursor,
} from "./search-input.js";
import { scrollListItemWithMargin } from "./scroll.js";
import {
  buildChannelStats,
  buildConversationItems,
  clampOffset,
  filterAndSortPosts,
  listChannels,
  nextChannelFilter,
  nextValue,
  offsetForPage,
  paginateItems,
  resolveConversationSelection,
} from "./selectors.js";
import {
  browseReducer,
  clampIndex,
  createInitialBrowseState,
  cycleThemeIndex,
  resolveDeleteTransition,
} from "./state.js";
import { computePickerLayout } from "./picker-layout.js";
import { THEMES } from "./theme.js";

const INFO_NOTICE_TTL_MS = 2500;
const ERROR_NOTICE_TTL_MS = 4000;
const MIN_REFRESH_VISIBLE_MS = 600;

export function BrowseApp(props: BrowseAppProps) {
  const screen = useScreen();
  const controller = useBrowseController(props, screen);
  return <BrowseScreen {...controller} />;
}

function useBrowseController(
  {
    postService,
    replyService,
    subscriptionService,
    availableReactions,
    availableRelationTypes,
    availableRelationCatalog,
    baseFilters,
    initialChannelFilter,
    limit,
    actor,
    session,
    refreshMs,
    initialAutoRefresh,
    initialPostId,
    initialSearchQuery,
    defaultChannel,
    preset,
  }: BrowseAppProps,
  screen: ReturnType<typeof useScreen>
) {
  const initialPostDraftRef = useRef(
    buildInitialPostComposerDraft({
      actor,
      session,
      defaultChannel,
      channel: initialChannelFilter === ALL_CHANNELS ? "" : initialChannelFilter,
    })
  );
  const initialSubscriptionDraftRef = useRef(
    buildInitialSubscriptionComposerDraft({
      actor,
      defaultChannel,
      channel: initialChannelFilter === ALL_CHANNELS ? "" : initialChannelFilter,
    })
  );
  const decoderRef = useRef(new TextDecoder());
  const rootRef = useRef<TermElement | null>(null);
  const listItemRefs = useRef<Array<TermElement | null>>([]);
  const channelItemRefs = useRef<Array<TermElement | null>>([]);
  const postScrollRef = useRef<TermElement | null>(null);
  const postContentRef = useRef<TermElement | null>(null);
  const shortcutsScrollRef = useRef<TermElement | null>(null);
  const replyInputRef = useRef<TermInput | null>(null);
  const postComposerInputRef = useRef<TermInput | null>(null);
  const subscriptionComposerInputRef = useRef<TermInput | null>(null);
  const composerPickerInputRef = useRef<TermInput | null>(null);
  const postComposerFieldItemRefs = useRef<Array<TermElement | null>>([]);
  const subscriptionComposerFieldItemRefs = useRef<Array<TermElement | null>>([]);
  const replyQuotesListRef = useRef<TermElement | null>(null);
  const replyQuotePreviewRef = useRef<TermElement | null>(null);
  const replyQuoteItemRefs = useRef<Array<TermElement | null>>([]);
  const gotoPageInputRef = useRef<TermInput | null>(null);
  const focusedReplyRefs = useRef<Array<TermElement | null>>([]);
  const bundleRef = useRef<ReadPostBundle | null>(null);
  const selectedPostIdRef = useRef<string | null>(null);
  const selectedIndexRef = useRef(0);
  const listOffsetRef = useRef(0);
  const channelFilterRef = useRef(initialChannelFilter);
  const sortModeRef = useRef<BrowseSortMode>("activity");
  const noticeRef = useRef<ReturnType<typeof createInitialBrowseState>["notice"]>(null);
  const viewRef = useRef<ReturnType<typeof createInitialBrowseState>["view"]>("list");
  const replyBodyRef = useRef("");
  const searchQueryRef = useRef(initialSearchQuery ?? "");
  const rawPostsRef = useRef<BrowseListPost[]>([]);
  const pendingSearchShortcutRef = useRef<string | null>(null);
  const pendingComposeShortcutRef = useRef<string | null>(null);
  const initialOpenAttemptedRef = useRef(false);
  const nextAutoRefreshAtRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRequestIdRef = useRef(0);
  const [autoRefreshNowMs, setAutoRefreshNowMs] = useState(() => Date.now());
  const [postComposerTextCursorIndices, setPostComposerTextCursorIndices] = useState<
    Partial<Record<PostComposerField, number>>
  >({});
  const [subscriptionComposerTextCursorIndices, setSubscriptionComposerTextCursorIndices] =
    useState<Partial<Record<SubscriptionComposerField, number>>>({});
  const [terminalSize, setTerminalSize] = useState(() => ({
    width: process.stdout.columns ?? 120,
    height: process.stdout.rows ?? 40,
  }));

  const [state, dispatch] = useReducer(
    browseReducer,
    createInitialBrowseState({
      initialChannelFilter,
      initialAutoRefresh,
      initialSearchQuery,
      initialPostComposerDraft: buildInitialPostComposerDraft({
        actor,
        session,
        defaultChannel,
        channel: initialChannelFilter === ALL_CHANNELS ? "" : initialChannelFilter,
      }),
      initialSubscriptionComposerDraft: buildInitialSubscriptionComposerDraft({
        actor,
        defaultChannel,
        channel: initialChannelFilter === ALL_CHANNELS ? "" : initialChannelFilter,
      }),
    })
  );

  const theme = THEMES[state.themeIndex];
  const channels = useMemo(() => listChannels(state.rawPosts), [state.rawPosts]);
  const channelStats = useMemo(() => buildChannelStats(state.rawPosts), [state.rawPosts]);
  const postPage = useMemo(
    () =>
      filterAndSortPosts(state.rawPosts, {
        channelFilter: state.channelFilter,
        sortMode: state.sortMode,
        limit,
        offset: state.listOffset,
      }),
    [limit, state.channelFilter, state.listOffset, state.rawPosts, state.sortMode]
  );
  const posts = postPage.items;
  const selectedPost = posts[state.selectedIndex] ?? null;
  const conversationItems = useMemo(
    () =>
      state.bundle
        ? buildConversationItems(state.bundle, {
            filterMode: state.conversationFilterMode,
            sortMode: state.conversationSortMode,
          })
        : [],
    [state.bundle, state.conversationFilterMode, state.conversationSortMode]
  );
  const absoluteConversationIndex = useMemo(
    () => resolveConversationSelection(conversationItems, state.focusedReplyIndex),
    [conversationItems, state.focusedReplyIndex]
  );
  const conversationPage = useMemo(
    () =>
      paginateItems(conversationItems, {
        limit: state.replyPageSize,
        offset: offsetForPage(state.replyPage, state.replyPageSize),
      }),
    [conversationItems, state.replyPage, state.replyPageSize]
  );
  const selectedConversationIndex = useMemo(() => {
    const pageIndex = conversationPage.items.findIndex(
      (item) => item.replyIndex === state.focusedReplyIndex
    );
    return pageIndex >= 0 ? pageIndex : 0;
  }, [conversationPage.items, state.focusedReplyIndex]);
  const selectedReplyQuote = useMemo(() => {
    if (state.replyQuotes.length === 0) {
      return null;
    }

    if (state.replyFocusedQuoteId) {
      return (
        state.replyQuotes.find((quote) => quote.id === state.replyFocusedQuoteId) ??
        state.replyQuotes[0]
      );
    }

    return state.replyQuotes[0];
  }, [state.replyFocusedQuoteId, state.replyQuotes]);
  const reactionPickerTarget = useMemo(() => {
    if (!state.bundle) {
      return null;
    }

    if (state.focusedReplyIndex === -1) {
      return {
        id: state.bundle.post.id,
        kind: "post" as const,
        label: "original post",
      };
    }

    const reply = state.bundle.replies[state.focusedReplyIndex];
    if (!reply) {
      return null;
    }

    return {
      id: reply.id,
      kind: "reply" as const,
      label: `reply ${state.focusedReplyIndex + 1}`,
    };
  }, [state.bundle, state.focusedReplyIndex]);
  const activeReplyRefs = useMemo(() => {
    if (!state.bundle || state.focusedReplyIndex < 0) {
      return [];
    }

    const reply = state.bundle.replies[state.focusedReplyIndex];
    const refs = reply?.data?.quoteRefs;
    return Array.isArray(refs) ? refs : [];
  }, [state.bundle, state.focusedReplyIndex]);
  const activeReplyRef = useMemo(() => {
    if (activeReplyRefs.length === 0) {
      return null;
    }

    const index = Math.max(0, Math.min(activeReplyRefs.length - 1, state.activeReplyRefIndex));
    return activeReplyRefs[index] ?? null;
  }, [activeReplyRefs, state.activeReplyRefIndex]);
  const activeSearchTextQuery = useMemo(
    () => parseStructuredSearchQuery(state.searchDraftQuery).text,
    [state.searchDraftQuery]
  );
  const visiblePostComposerFields = useMemo(
    () => getVisiblePostComposerFields(state.postComposerDraft),
    [state.postComposerDraft]
  );
  const activeComposeFieldKind = useMemo(() => {
    if (state.view === "compose-post") {
      return getPostComposerFieldKind(state.postComposerField);
    }
    if (state.view === "compose-subscription") {
      return getSubscriptionComposerFieldKind(state.subscriptionComposerField);
    }
    return null;
  }, [state.postComposerField, state.subscriptionComposerField, state.view]);
  const activeComposeFieldSupportsPicker = useMemo(() => {
    if (state.view === "compose-post") {
      return isPostComposerPickerField(state.postComposerField);
    }
    if (state.view === "compose-subscription") {
      return isSubscriptionComposerPickerField(state.subscriptionComposerField);
    }
    return false;
  }, [state.postComposerField, state.subscriptionComposerField, state.view]);
  const activePostComposerTextCursorIndex = useMemo(
    () =>
      clampCursorIndex(
        state.postComposerDraft[state.postComposerField] ?? "",
        postComposerTextCursorIndices[state.postComposerField] ??
          Array.from(state.postComposerDraft[state.postComposerField] ?? "").length
      ),
    [postComposerTextCursorIndices, state.postComposerDraft, state.postComposerField]
  );
  const activeSubscriptionComposerTextCursorIndex = useMemo(
    () =>
      clampCursorIndex(
        state.subscriptionComposerDraft[state.subscriptionComposerField] ?? "",
        subscriptionComposerTextCursorIndices[state.subscriptionComposerField] ??
          Array.from(state.subscriptionComposerDraft[state.subscriptionComposerField] ?? "").length
      ),
    [
      state.subscriptionComposerDraft,
      state.subscriptionComposerField,
      subscriptionComposerTextCursorIndices,
    ]
  );
  const activeSearchQuery = useMemo(() => state.searchQuery.trim(), [state.searchQuery]);
  const hasPendingWork = useMemo(() => {
    if (state.replyBody.trim() || state.replyQuotes.length > 0) {
      return true;
    }

    if (JSON.stringify(state.postComposerDraft) !== JSON.stringify(initialPostDraftRef.current)) {
      return true;
    }

    if (
      JSON.stringify(state.subscriptionComposerDraft) !==
      JSON.stringify(initialSubscriptionDraftRef.current)
    ) {
      return true;
    }

    return (
      Boolean(state.composerPickerTarget) ||
      state.searchMode ||
      Boolean(state.gotoPageMode) ||
      Boolean(state.reactionPickerMode)
    );
  }, [
    state.composerPickerTarget,
    state.gotoPageMode,
    state.postComposerDraft,
    state.reactionPickerMode,
    state.replyBody,
    state.replyQuotes.length,
    state.searchMode,
    state.subscriptionComposerDraft,
  ]);
  const hasDirtyReplyDraft = useMemo(
    () => state.replyBody.trim().length > 0 || state.replyQuotes.length > 0,
    [state.replyBody, state.replyQuotes.length]
  );
  const hasDirtyPostComposerDraft = useMemo(() => {
    const draft = state.postComposerDraft;
    return (
      draft.channel.trim().length > 0 ||
      draft.type.trim() !== "finding" ||
      draft.title.trim().length > 0 ||
      draft.body.trim().length > 0 ||
      draft.severity.trim().length > 0 ||
      draft.data.trim().length > 0 ||
      draft.tags.trim().length > 0 ||
      draft.actor.trim().length > 0 ||
      draft.session.trim().length > 0 ||
      draft.relationType.trim() !== "relates-to" ||
      draft.relatedPostId.trim().length > 0 ||
      draft.blocking.trim().length > 0 ||
      draft.pinned.trim().length > 0 ||
      draft.assignedTo.trim().length > 0 ||
      draft.idempotencyKey.trim().length > 0
    );
  }, [state.postComposerDraft]);
  const hasDirtySubscriptionComposerDraft = useMemo(() => {
    const draft = state.subscriptionComposerDraft;
    return (
      draft.mode.trim() !== "subscribe" ||
      draft.actor.trim().length > 0 ||
      draft.channel.trim().length > 0 ||
      draft.tags.trim().length > 0
    );
  }, [state.subscriptionComposerDraft]);
  const availableSearchValues = useMemo(
    () => ({
      tag: [...new Set(state.rawPosts.flatMap((post) => post.tags))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
      actor: [
        ...new Set(state.rawPosts.map((post) => post.actor).filter(Boolean) as string[]),
      ].sort((left, right) => left.localeCompare(right)),
      session: [
        ...new Set(state.rawPosts.map((post) => post.session).filter(Boolean) as string[]),
      ].sort((left, right) => left.localeCompare(right)),
      assigned: [
        ...new Set(state.rawPosts.map((post) => post.assignedTo).filter(Boolean) as string[]),
      ].sort((left, right) => left.localeCompare(right)),
      channel: [...new Set(state.rawPosts.map((post) => post.channel).filter(Boolean))].sort(
        (left, right) => left.localeCompare(right)
      ),
      status: [...POST_STATUSES],
      type: orderedUniqueStrings([
        ...preset.typeOrder,
        ...[...new Set(state.rawPosts.map((post) => post.type).filter(Boolean))].sort(
          (left, right) => left.localeCompare(right)
        ),
      ]),
      severity: [...SEVERITIES],
    }),
    [preset.typeOrder, state.rawPosts]
  );
  const channelSuggestions = useMemo(
    () => [...new Set(state.rawPosts.map((post) => post.channel).filter(Boolean))].sort(),
    [state.rawPosts]
  );
  const postComposerSuggestions = useMemo(
    () =>
      buildPostComposerSuggestionLookup({
        types: availableSearchValues.type,
        channels: channelSuggestions,
        actors: availableSearchValues.actor,
        sessions: availableSearchValues.session,
        assignedTo: availableSearchValues.assigned,
        relationTypes: availableRelationTypes,
        relatedPostIds: state.rawPosts.map((post) => post.id),
        tags: availableSearchValues.tag,
      }),
    [
      availableSearchValues.actor,
      availableSearchValues.assigned,
      availableSearchValues.session,
      availableSearchValues.type,
      availableSearchValues.tag,
      availableRelationTypes,
      channelSuggestions,
      state.rawPosts,
    ]
  );
  const postComposerRefSuggestionDetails = useMemo(
    () =>
      Object.fromEntries(
        state.rawPosts.map((post) => [
          post.id,
          [post.title?.trim(), post.actor ? `@${post.actor}` : null].filter(Boolean).join(" · "),
        ])
      ),
    [state.rawPosts]
  );
  const relationCatalogByType = useMemo(
    () =>
      Object.fromEntries(
        availableRelationCatalog.map((entry) => [entry.value, entry.description ?? ""])
      ),
    [availableRelationCatalog]
  );
  const activeRelations = useMemo<BrowseRelationSummary[]>(() => {
    if (!state.bundle || state.focusedReplyIndex !== -1) {
      return [];
    }

    return state.bundle.relations.map((relation) =>
      summarizeRelation(
        relation,
        state.bundle!.post.id,
        postComposerRefSuggestionDetails,
        relationCatalogByType
      )
    );
  }, [
    postComposerRefSuggestionDetails,
    relationCatalogByType,
    state.bundle,
    state.focusedReplyIndex,
  ]);
  const activeRelation = useMemo(() => {
    if (activeRelations.length === 0) {
      return null;
    }

    const index = Math.max(0, Math.min(activeRelations.length - 1, state.activeReplyRefIndex));
    return activeRelations[index] ?? null;
  }, [activeRelations, state.activeReplyRefIndex]);
  const subscriptionComposerSuggestions = useMemo(
    () =>
      buildSubscriptionComposerSuggestionLookup({
        channels: channelSuggestions,
        actors: availableSearchValues.actor,
        tags: availableSearchValues.tag,
      }),
    [availableSearchValues.actor, availableSearchValues.tag, channelSuggestions]
  );
  const composerPickerItems = useMemo(() => {
    if (!state.composerPickerTarget) {
      return [];
    }

    if (state.composerPickerTarget.composer === "post") {
      return buildPostComposerPickerItems({
        field: state.composerPickerTarget.field,
        value: state.composerPickerQuery,
        lookup: postComposerSuggestions,
        refDetails: postComposerRefSuggestionDetails,
        relationCatalog: availableRelationCatalog,
        relatedPosts: state.rawPosts.map((post) => ({
          id: post.id,
          title: post.title,
          actor: post.actor,
        })),
        exactMatchWindow: state.composerPickerPristine,
        limit: 50,
      });
    }

    return buildSubscriptionComposerPickerItems({
      field: state.composerPickerTarget.field,
      value: state.composerPickerQuery,
      lookup: subscriptionComposerSuggestions,
      exactMatchWindow: state.composerPickerPristine,
      limit: 50,
    });
  }, [
    availableRelationCatalog,
    postComposerRefSuggestionDetails,
    postComposerSuggestions,
    state.composerPickerPristine,
    state.composerPickerQuery,
    state.composerPickerTarget,
    state.rawPosts,
    subscriptionComposerSuggestions,
  ]);
  const composerPickerLayout = useMemo(() => {
    if (!state.composerPickerTarget) {
      return { visibleLimit: 5, hideDescriptions: false };
    }

    const preferredLimit =
      state.composerPickerTarget.composer === "post"
        ? isPostComposerDynamicPickerField(state.composerPickerTarget.field)
          ? 5
          : Math.min(9, Math.max(1, composerPickerItems.length))
        : isSubscriptionComposerDynamicPickerField(state.composerPickerTarget.field)
          ? 5
          : Math.min(9, Math.max(1, composerPickerItems.length));

    return computePickerLayout({
      preferredLimit,
      itemCount: composerPickerItems.length,
      hasDescriptions: composerPickerItems.some((item) => Boolean(item.description?.trim())),
      terminalHeight: terminalSize.height,
    });
  }, [composerPickerItems, state.composerPickerTarget, terminalSize.height]);
  const composerPickerVisibleLimit = composerPickerLayout.visibleLimit;
  const composerPickerHideDescriptions = composerPickerLayout.hideDescriptions;
  const composerPickerPageStart = useMemo(() => {
    const pageSize = Math.max(1, composerPickerVisibleLimit);
    const pageIndex = Math.max(0, Math.floor(state.composerPickerSelectedIndex / pageSize));
    return pageIndex * pageSize;
  }, [composerPickerVisibleLimit, state.composerPickerSelectedIndex]);
  const searchValueSuggestions = useMemo(
    () => getSearchValueSuggestions(state.searchDraftQuery, availableSearchValues, 8),
    [availableSearchValues, state.searchDraftQuery]
  );
  const searchBuilderValueSuggestions = useMemo(
    () =>
      getSearchBuilderValueSuggestions(
        state.searchBuilderField,
        state.searchBuilderValue,
        availableSearchValues,
        8
      ),
    [availableSearchValues, state.searchBuilderField, state.searchBuilderValue]
  );
  const now = useMemo(() => new Date(), [state.lastRefreshAt]);
  const terminalWidth = terminalSize.width;
  const terminalHeight = terminalSize.height;
  const autoRefreshCountdownMs = useMemo(() => {
    if (
      !state.autoRefreshEnabled ||
      state.view === "reply" ||
      nextAutoRefreshAtRef.current == null
    ) {
      return null;
    }

    return Math.max(0, nextAutoRefreshAtRef.current - autoRefreshNowMs);
  }, [autoRefreshNowMs, state.autoRefreshEnabled, state.view]);

  useEffect(() => {
    bundleRef.current = state.bundle;
  }, [state.bundle]);

  useEffect(() => {
    selectedPostIdRef.current = selectedPost?.id ?? null;
  }, [selectedPost]);

  useEffect(() => {
    selectedIndexRef.current = state.selectedIndex;
  }, [state.selectedIndex]);

  useEffect(() => {
    listOffsetRef.current = state.listOffset;
  }, [state.listOffset]);

  useEffect(() => {
    channelFilterRef.current = state.channelFilter;
  }, [state.channelFilter]);

  useEffect(() => {
    sortModeRef.current = state.sortMode;
  }, [state.sortMode]);

  useEffect(() => {
    noticeRef.current = state.notice;
  }, [state.notice]);

  useEffect(() => {
    viewRef.current = state.view;
  }, [state.view]);

  useEffect(() => {
    replyBodyRef.current = state.replyBody;
  }, [state.replyBody]);

  useEffect(() => {
    searchQueryRef.current = state.searchQuery;
  }, [state.searchQuery]);

  useEffect(() => {
    rawPostsRef.current = state.rawPosts;
  }, [state.rawPosts]);

  useEffect(() => {
    const handleResize = () => {
      setTerminalSize((current) => {
        const next = {
          width: process.stdout.columns ?? current.width,
          height: process.stdout.rows ?? current.height,
        };

        if (next.width === current.width && next.height === current.height) {
          return current;
        }

        return next;
      });
    };

    process.stdout.addListener("resize", handleResize);
    return () => {
      process.stdout.removeListener("resize", handleResize);
    };
  }, []);

  const refreshReadProgress = useCallback(() => {
    const element = postContentRef.current;
    if (!element) {
      dispatch({ type: "patch", patch: { readProgressLabel: "[100% read]" } });
      return;
    }

    dispatch({
      type: "patch",
      patch: {
        readProgressLabel: buildReadProgressLabel(
          element.scrollTop,
          element.scrollHeight,
          element.offsetHeight
        ),
      },
    });
  }, []);

  const resolveFocusedQuote = useCallback((): ReplyQuote | null => {
    if (!state.bundle) {
      return null;
    }

    if (state.focusedReplyIndex === -1) {
      return {
        id: state.bundle.post.id,
        kind: "post",
        label: "Original post",
        text: state.bundle.post.body,
        author: state.bundle.post.actor ?? actor ?? "unknown",
        replyIndex: -1,
      };
    }

    const selectedReply = state.bundle.replies[state.focusedReplyIndex];
    if (!selectedReply) {
      return null;
    }

    return {
      id: selectedReply.id,
      kind: "reply",
      label: `Reply ${state.focusedReplyIndex + 1}`,
      text: selectedReply.body,
      author: selectedReply.actor ?? "unknown",
      replyIndex: state.focusedReplyIndex,
    };
  }, [actor, state.bundle, state.focusedReplyIndex]);

  const clearTransientTimers = useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const showTransientNotice = useCallback(
    (
      notice: NonNullable<ReturnType<typeof createInitialBrowseState>["notice"]>,
      ttlMs = INFO_NOTICE_TTL_MS
    ) => {
      if (noticeTimeoutRef.current) {
        clearTimeout(noticeTimeoutRef.current);
      }

      dispatch({ type: "setNotice", notice });
      noticeTimeoutRef.current = setTimeout(() => {
        noticeTimeoutRef.current = null;
        if (noticeRef.current?.kind === notice.kind && noticeRef.current.text === notice.text) {
          dispatch({ type: "setNotice", notice: null });
        }
      }, ttlMs);
    },
    []
  );

  const showTransientError = useCallback(
    (text: string, ttlMs = ERROR_NOTICE_TTL_MS) => {
      showTransientNotice({ kind: "error", text }, ttlMs);
    },
    [showTransientNotice]
  );

  const finishRefresh = useCallback(
    (
      requestId: number,
      patch: Partial<ReturnType<typeof createInitialBrowseState>>,
      delayMs: number
    ) => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      const applyPatch = () => {
        if (refreshRequestIdRef.current !== requestId) {
          return;
        }
        refreshTimeoutRef.current = null;
        dispatch({ type: "patch", patch: patch as never });
      };

      if (delayMs <= 0) {
        applyPatch();
        return;
      }

      refreshTimeoutRef.current = setTimeout(applyPatch, delayMs);
    },
    []
  );

  const refreshData = useCallback(
    (
      reason: "initial" | "manual" | "auto" | "reply",
      focusedId?: string,
      overrides?: { currentOffset?: number; searchQuery?: string }
    ) => {
      const requestId = ++refreshRequestIdRef.current;
      const startedAt = Date.now();
      dispatch({
        type: "patch",
        patch: reason === "initial" ? { loading: true } : { refreshing: true },
      });

      void (async () => {
        try {
          // Use refs for the currently open bundle/filter/sort so refresh and
          // auto-refresh callbacks can preserve UI context without stale closures.
          const result = await refreshBrowseData({
            postService,
            baseFilters,
            channelFilter: channelFilterRef.current,
            sortMode: sortModeRef.current,
            limit,
            currentOffset: overrides?.currentOffset ?? listOffsetRef.current,
            currentIndex: selectedIndexRef.current,
            currentRawPosts: rawPostsRef.current,
            currentBundle: bundleRef.current,
            searchQuery: overrides?.searchQuery ?? searchQueryRef.current,
            focusedId: focusedId ?? selectedPostIdRef.current ?? undefined,
          });

          const patch = {
            rawPosts: result.rawPosts,
            selectedIndex: result.selectedIndex,
            listOffset: result.listOffset,
            bundle: result.bundle,
            changedPostIds: result.changedPostIds,
            lastRefreshAt: formatRefreshClock(),
            loading: false,
            refreshing: false,
            notice: noticeRef.current,
          };
          const delayMs =
            reason === "initial"
              ? 0
              : Math.max(0, MIN_REFRESH_VISIBLE_MS - (Date.now() - startedAt));
          finishRefresh(requestId, patch, delayMs);

          if (reason === "manual") {
            showTransientNotice({ kind: "info", text: "Feed refreshed." });
          } else if (reason === "reply" && focusedId) {
            showTransientNotice({ kind: "info", text: `Reply posted to ${focusedId}.` });
          }
        } catch (error) {
          const patch = {
            bundle: bundleRef.current ? null : null,
            view: bundleRef.current ? "list" : viewRef.current,
            replyBody: bundleRef.current ? "" : replyBodyRef.current,
            notice: {
              kind: "error" as const,
              text: bundleRef.current
                ? `Open post is no longer available. ${toMessage(error)}`
                : toMessage(error),
            },
            changedPostIds: [],
            loading: false,
            refreshing: false,
          };
          const delayMs =
            reason === "initial"
              ? 0
              : Math.max(0, MIN_REFRESH_VISIBLE_MS - (Date.now() - startedAt));
          finishRefresh(requestId, patch, delayMs);
        }
      })();
    },
    [baseFilters, finishRefresh, limit, postService, showTransientNotice]
  );

  const openPost = useCallback(
    (postId: string) => {
      void (async () => {
        try {
          if (session) {
            await postService.markRead(session, [postId]);
          }
          const nextBundle = await postService.getPost(postId);
          dispatch({ type: "openBundle", bundle: nextBundle });
        } catch (error) {
          dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
        }
      })();
    },
    [postService, session]
  );

  const toggleAutoRefresh = useCallback(() => {
    const next = !state.autoRefreshEnabled;
    dispatch({
      type: "patch",
      patch: {
        autoRefreshEnabled: next,
      },
    });
    showTransientNotice({
      kind: "info",
      text: next ? `Auto refresh enabled.` : "Auto refresh paused.",
    });
  }, [showTransientNotice, state.autoRefreshEnabled]);

  const clearNotice = useCallback(() => {
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
    dispatch({ type: "setNotice", notice: null });
  }, []);

  const submitReply = useCallback(() => {
    if (!state.bundle) {
      return;
    }

    void (async () => {
      try {
        await submitBrowseReply(replyService, {
          postId: state.bundle.post.id,
          body: state.replyBody,
          actor,
          quotes: state.replyQuotes,
        });
        dispatch({
          type: "patch",
          patch: {
            replyBody: "",
            replyQuotes: [],
            replyFocusedQuoteId: null,
            replySectionFocus: "editor",
            view: "post",
          },
        });
        refreshData("reply", state.bundle.post.id);
      } catch (error) {
        dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
      }
    })();
  }, [actor, refreshData, replyService, state.bundle, state.replyBody, state.replyQuotes]);

  const updatePostComposerField = useCallback(
    (
      field: keyof typeof state.postComposerDraft,
      value: string,
      options?: { cursorIndex?: number }
    ) => {
      setPostComposerTextCursorIndices((current) => ({
        ...current,
        [field]: options?.cursorIndex ?? Array.from(value).length,
      }));
      dispatch({
        type: "patch",
        patch: {
          postComposerDraft: {
            ...state.postComposerDraft,
            [field]: value,
          },
        },
      });
    },
    [state.postComposerDraft]
  );

  const updateSubscriptionComposerField = useCallback(
    (
      field: keyof typeof state.subscriptionComposerDraft,
      value: string,
      options?: { cursorIndex?: number }
    ) => {
      setSubscriptionComposerTextCursorIndices((current) => ({
        ...current,
        [field]: options?.cursorIndex ?? Array.from(value).length,
      }));
      dispatch({
        type: "patch",
        patch: {
          subscriptionComposerDraft: {
            ...state.subscriptionComposerDraft,
            [field]: value,
          },
        },
      });
    },
    [state.subscriptionComposerDraft]
  );

  const openComposerPicker = useCallback(() => {
    if (state.view === "compose-post") {
      if (!isPostComposerPickerField(state.postComposerField)) {
        return;
      }
      dispatch({
        type: "patch",
        patch: {
          composerPickerTarget: { composer: "post", field: state.postComposerField },
          composerPickerQuery: state.postComposerDraft[state.postComposerField] ?? "",
          composerPickerSelectedIndex: 0,
          composerPickerPristine: true,
        },
      });
      return;
    }

    if (state.view === "compose-subscription") {
      if (!isSubscriptionComposerPickerField(state.subscriptionComposerField)) {
        return;
      }
      dispatch({
        type: "patch",
        patch: {
          composerPickerTarget: {
            composer: "subscription",
            field: state.subscriptionComposerField,
          },
          composerPickerQuery:
            state.subscriptionComposerDraft[state.subscriptionComposerField] ?? "",
          composerPickerSelectedIndex: 0,
          composerPickerPristine: true,
        },
      });
    }
  }, [
    state.postComposerDraft,
    state.postComposerField,
    state.subscriptionComposerDraft,
    state.subscriptionComposerField,
    state.view,
  ]);

  const openPostComposer = useCallback(() => {
    const contextualChannel =
      state.view === "channels"
        ? state.channelSelectedIndex === 0
          ? defaultChannel
          : (channelStats[state.channelSelectedIndex - 1]?.name ?? defaultChannel)
        : state.bundle?.post.channel ||
          (state.channelFilter !== ALL_CHANNELS ? state.channelFilter : "");

    setPostComposerTextCursorIndices({});
    dispatch({
      type: "patch",
      patch: {
        view: "compose-post",
        postComposerField: "channel",
        composerPickerTarget: null,
        composerPickerQuery: "",
        composerPickerSelectedIndex: 0,
        composerPickerPristine: false,
        postComposerDraft: buildInitialPostComposerDraft({
          actor,
          session,
          defaultChannel,
          channel: contextualChannel || "",
          relatedPostId: state.bundle?.post.id ?? null,
          relationType: "relates-to",
        }),
      },
    });
  }, [
    actor,
    channelStats,
    defaultChannel,
    session,
    state.bundle?.post.id,
    state.bundle?.post.channel,
    state.channelFilter,
    state.channelSelectedIndex,
    state.view,
  ]);

  const openSubscriptionComposer = useCallback(() => {
    const contextualChannel =
      state.view === "channels"
        ? state.channelSelectedIndex === 0
          ? defaultChannel
          : (channelStats[state.channelSelectedIndex - 1]?.name ?? defaultChannel)
        : state.bundle?.post.channel ||
          (state.channelFilter !== ALL_CHANNELS ? state.channelFilter : "");

    setSubscriptionComposerTextCursorIndices({});
    dispatch({
      type: "patch",
      patch: {
        view: "compose-subscription",
        subscriptionComposerField: "mode",
        composerPickerTarget: null,
        composerPickerQuery: "",
        composerPickerSelectedIndex: 0,
        composerPickerPristine: false,
        subscriptionComposerDraft: buildInitialSubscriptionComposerDraft({
          actor,
          defaultChannel,
          channel: contextualChannel || "",
        }),
      },
    });
  }, [
    actor,
    channelStats,
    defaultChannel,
    state.bundle?.post.channel,
    state.channelFilter,
    state.channelSelectedIndex,
    state.view,
  ]);

  const submitPost = useCallback(() => {
    dispatch({ type: "patch", patch: { busyOperationKind: "submit-post" } });
    void (async () => {
      try {
        const result = await submitBrowsePost(postService, state.postComposerDraft);
        dispatch({
          type: "patch",
          patch: {
            busyOperationKind: null,
            view: "list",
            postComposerField: "channel",
          },
        });
        refreshData("post", result.id);
        showTransientNotice({ kind: "info", text: `Created post ${result.id}.` });
      } catch (error) {
        dispatch({
          type: "patch",
          patch: { busyOperationKind: null },
        });
        showTransientError(toMessage(error));
      }
    })();
  }, [postService, refreshData, showTransientError, showTransientNotice, state.postComposerDraft]);

  const submitSubscription = useCallback(() => {
    dispatch({ type: "patch", patch: { busyOperationKind: "submit-subscription" } });
    void (async () => {
      try {
        const result = await submitBrowseSubscription(
          subscriptionService,
          state.subscriptionComposerDraft
        );
        const mode = state.subscriptionComposerDraft.mode.trim() || "subscribe";
        dispatch({
          type: "patch",
          patch: {
            busyOperationKind: null,
            view: "channels",
            subscriptionComposerField: "mode",
          },
        });
        refreshData("manual");
        showTransientNotice({
          kind: "info",
          text:
            mode === "unsubscribe"
              ? `Removed ${result.removed ?? 0} subscription(s).`
              : `Subscription updated for #${state.subscriptionComposerDraft.channel.trim()}.`,
        });
      } catch (error) {
        dispatch({
          type: "patch",
          patch: { busyOperationKind: null },
        });
        showTransientError(toMessage(error));
      }
    })();
  }, [
    refreshData,
    showTransientError,
    showTransientNotice,
    state.subscriptionComposerDraft,
    subscriptionService,
  ]);

  const executeDelete = useCallback(() => {
    if (!state.confirmDelete) {
      return;
    }

    void (async () => {
      try {
        const deletedPostId = state.confirmDelete.id;
        await postService.deletePost(deletedPostId);
        const nextState = resolveDeleteTransition({
          currentBundle: state.bundle,
          currentView: state.view,
          currentFocusedId: selectedPostIdRef.current,
          deletedPostId,
        });

        // Keep refresh in sync with the delete action before React flushes state.
        bundleRef.current = nextState.bundle;
        viewRef.current = nextState.view;
        selectedPostIdRef.current = nextState.focusedId;

        dispatch({
          type: "patch",
          patch: {
            confirmDelete: null,
            bundle: nextState.bundle,
            view: nextState.view,
            notice: {
              kind: "info",
              text: `Deleted: ${state.confirmDelete.title} (${deletedPostId})`,
            },
          },
        });
        refreshData("manual");
      } catch (error) {
        dispatch({
          type: "patch",
          patch: {
            confirmDelete: null,
            notice: { kind: "error", text: toMessage(error) },
          },
        });
      }
    })();
  }, [postService, refreshData, state.bundle, state.confirmDelete, state.view]);

  useEffect(() => {
    refreshData("initial");
  }, [refreshData]);

  useEffect(() => {
    return () => {
      clearTransientTimers();
    };
  }, [clearTransientTimers]);

  useEffect(() => {
    if (!initialPostId || state.loading || initialOpenAttemptedRef.current) {
      return;
    }

    initialOpenAttemptedRef.current = true;
    openPost(initialPostId);
  }, [initialPostId, openPost, state.loading]);

  useEffect(() => {
    if (state.searchMode) {
      rootRef.current?.focus();
      return;
    }

    if (state.composerPickerTarget) {
      rootRef.current?.focus();
      return;
    }

    if (state.reactionPickerMode) {
      rootRef.current?.focus();
      return;
    }

    if (state.gotoPageMode) {
      gotoPageInputRef.current?.focus();
      const timeout = setTimeout(() => {
        gotoPageInputRef.current?.focus();
      }, 0);
      return () => {
        clearTimeout(timeout);
      };
    }

    if (state.view === "reply") {
      const replyInput = replyInputRef.current as (TermInput & { blur?: () => void }) | null;
      if (state.replySectionFocus !== "editor") {
        replyInput?.blur?.();
        rootRef.current?.focus();
        return;
      }
      replyInput?.focus();
      const timeout = setTimeout(() => {
        replyInput?.focus();
      }, 0);
      return () => {
        clearTimeout(timeout);
      };
    }

    if (state.view === "compose-post") {
      const inputRef = postComposerInputRef.current as (TermInput & { blur?: () => void }) | null;
      if (activeComposeFieldKind === "multiline") {
        inputRef?.focus();
        const timeout = setTimeout(() => {
          inputRef?.focus();
        }, 0);
        return () => {
          clearTimeout(timeout);
        };
      }
      inputRef?.blur?.();
      rootRef.current?.focus();
      return;
    }

    if (state.view === "compose-subscription") {
      const inputRef = subscriptionComposerInputRef.current as
        | (TermInput & { blur?: () => void })
        | null;
      if (activeComposeFieldKind === "multiline") {
        inputRef?.focus();
        const timeout = setTimeout(() => {
          inputRef?.focus();
        }, 0);
        return () => {
          clearTimeout(timeout);
        };
      }
      inputRef?.blur?.();
      rootRef.current?.focus();
      return;
    }

    rootRef.current?.focus();
  }, [
    activeComposeFieldKind,
    state.composerPickerTarget,
    state.gotoPageMode,
    state.postComposerField,
    state.reactionPickerMode,
    state.replySectionFocus,
    state.searchMode,
    state.subscriptionComposerField,
    state.view,
  ]);

  useEffect(() => {
    if (state.view !== "compose-post") {
      return;
    }

    if (visiblePostComposerFields.includes(state.postComposerField)) {
      return;
    }

    dispatch({
      type: "patch",
      patch: { postComposerField: visiblePostComposerFields[0] ?? "channel" },
    });
  }, [state.postComposerField, state.view, visiblePostComposerFields]);

  useEffect(() => {
    if (state.view === "compose-post") {
      const index = Math.max(0, visiblePostComposerFields.indexOf(state.postComposerField));
      scrollListItemWithMargin({
        item: postComposerFieldItemRefs.current[index] ?? null,
        marginRows: 1,
      });
    }
  }, [state.postComposerField, state.view, visiblePostComposerFields]);

  useEffect(() => {
    if (state.view === "compose-subscription") {
      const index = Math.max(
        0,
        SUBSCRIPTION_COMPOSER_FIELDS.indexOf(state.subscriptionComposerField)
      );
      scrollListItemWithMargin({
        item: subscriptionComposerFieldItemRefs.current[index] ?? null,
        marginRows: 1,
      });
    }
  }, [state.subscriptionComposerField, state.view]);

  useEffect(() => {
    if (state.view === "list") {
      scrollListItemWithMargin({
        item: listItemRefs.current[state.selectedIndex],
        marginRows: 1,
      });
    }
  }, [posts.length, state.selectedIndex, state.view]);

  useEffect(() => {
    if (state.view === "channels") {
      channelItemRefs.current[state.channelSelectedIndex]?.scrollIntoView({ alignY: "auto" });
    }
  }, [channelStats.length, state.channelSelectedIndex, state.view]);

  useEffect(() => {
    if (state.view === "post") {
      if (postScrollRef.current) {
        postScrollRef.current.scrollTop = 0;
      }
      if (postContentRef.current) {
        postContentRef.current.scrollTop = 0;
      }
      refreshReadProgress();
    }
  }, [refreshReadProgress, state.bundle?.post.id, state.replyPage, state.view]);

  useEffect(() => {
    if (state.view === "post" && selectedConversationIndex >= 0) {
      focusedReplyRefs.current[selectedConversationIndex]?.scrollIntoView({ alignY: "auto" });
      if (postContentRef.current) {
        postContentRef.current.scrollTop = 0;
      }
      refreshReadProgress();
    }
  }, [refreshReadProgress, selectedConversationIndex, state.view]);

  useEffect(() => {
    if (state.view !== "reader") {
      return;
    }

    if (postContentRef.current) {
      postContentRef.current.scrollTop = 0;
    }
    refreshReadProgress();
  }, [refreshReadProgress, state.bundle?.post.id, state.focusedReplyIndex, state.view]);

  useEffect(() => {
    if (state.view !== "reply") {
      return;
    }

    if (state.replyQuotes.length === 0) {
      if (state.replyFocusedQuoteId !== null || state.replySectionFocus !== "editor") {
        dispatch({
          type: "patch",
          patch: { replyFocusedQuoteId: null, replySectionFocus: "editor" },
        });
      }
      return;
    }

    const currentExists = state.replyQuotes.some((quote) => quote.id === state.replyFocusedQuoteId);
    if (!currentExists) {
      dispatch({
        type: "patch",
        patch: { replyFocusedQuoteId: state.replyQuotes[0].id },
      });
    }
  }, [state.replyFocusedQuoteId, state.replyQuotes, state.replySectionFocus, state.view]);

  useEffect(() => {
    if (state.view !== "reply" || state.replySectionFocus !== "preview") {
      return;
    }

    if (replyQuotePreviewRef.current) {
      replyQuotePreviewRef.current.scrollTop = 0;
    }
  }, [selectedReplyQuote?.id, state.replySectionFocus, state.view]);

  useEffect(() => {
    if (state.view !== "reply" || !selectedReplyQuote) {
      return;
    }

    const selectedIndex = state.replyQuotes.findIndex(
      (quote) => quote.id === selectedReplyQuote.id
    );
    if (selectedIndex >= 0) {
      replyQuoteItemRefs.current[selectedIndex]?.scrollIntoView({ alignY: "auto" });
    }
  }, [selectedReplyQuote, state.replyQuotes, state.view]);

  useEffect(() => {
    if (state.view !== "post" && state.view !== "reader") {
      return;
    }

    const referenceCount =
      state.focusedReplyIndex === -1 ? activeRelations.length : activeReplyRefs.length;

    if (referenceCount === 0) {
      if (state.activeReplyRefIndex !== 0) {
        dispatch({ type: "patch", patch: { activeReplyRefIndex: 0 } });
      }
      return;
    }

    const clamped = Math.max(0, Math.min(referenceCount - 1, state.activeReplyRefIndex));
    if (clamped !== state.activeReplyRefIndex) {
      dispatch({ type: "patch", patch: { activeReplyRefIndex: clamped } });
    }
  }, [
    activeRelations.length,
    activeReplyRefs.length,
    state.activeReplyRefIndex,
    state.focusedReplyIndex,
    state.view,
  ]);

  useEffect(() => {
    if (state.view !== "post") {
      return;
    }

    if (conversationItems.length === 0) {
      dispatch({ type: "patch", patch: { focusedReplyIndex: -1, replyPage: 1 } });
      return;
    }

    const currentExists = conversationItems.some(
      (item) => item.replyIndex === state.focusedReplyIndex
    );
    const nextFocusedReplyIndex = currentExists
      ? state.focusedReplyIndex
      : conversationItems[0].replyIndex;
    const nextPage =
      Math.floor(
        resolveConversationSelection(conversationItems, nextFocusedReplyIndex) / state.replyPageSize
      ) + 1;

    if (!currentExists || nextPage !== state.replyPage) {
      dispatch({
        type: "patch",
        patch: { focusedReplyIndex: nextFocusedReplyIndex, replyPage: nextPage },
      });
    }
  }, [
    conversationItems,
    state.focusedReplyIndex,
    state.replyPage,
    state.replyPageSize,
    state.view,
  ]);

  useEffect(() => {
    if (postPage.offset !== state.listOffset) {
      dispatch({ type: "patch", patch: { listOffset: postPage.offset } });
      return;
    }

    if (posts.length === 0 && state.selectedIndex !== 0) {
      dispatch({ type: "patch", patch: { selectedIndex: 0 } });
      return;
    }

    if (posts.length > 0 && state.selectedIndex >= posts.length) {
      dispatch({ type: "patch", patch: { selectedIndex: posts.length - 1 } });
    }
  }, [postPage.offset, posts.length, state.listOffset, state.selectedIndex]);

  useEffect(() => {
    if (
      !state.autoRefreshEnabled ||
      state.view === "reply" ||
      state.view === "compose-post" ||
      state.view === "compose-subscription"
    ) {
      nextAutoRefreshAtRef.current = null;
      return;
    }

    nextAutoRefreshAtRef.current = Date.now() + refreshMs;
    const interval = setInterval(() => {
      refreshData("auto");
      nextAutoRefreshAtRef.current = Date.now() + refreshMs;
      setAutoRefreshNowMs(Date.now());
    }, refreshMs);

    return () => clearInterval(interval);
  }, [refreshData, refreshMs, state.autoRefreshEnabled, state.view]);

  useEffect(() => {
    if (
      !state.autoRefreshEnabled ||
      state.view === "reply" ||
      state.view === "compose-post" ||
      state.view === "compose-subscription"
    ) {
      return;
    }

    setAutoRefreshNowMs(Date.now());
    const tick = setInterval(() => {
      setAutoRefreshNowMs(Date.now());
    }, 1000);

    return () => clearInterval(tick);
  }, [state.autoRefreshEnabled, state.view]);

  const setListPage = useCallback(
    (page: number) => {
      const nextOffset = clampOffset(offsetForPage(page, limit), postPage.totalCount, limit);
      dispatch({
        type: "patch",
        patch: {
          listOffset: nextOffset,
          selectedIndex: 0,
        },
      });
      showTransientNotice({
        kind: "info",
        text: `Showing ${page < 1 ? 1 : Math.floor(nextOffset / limit) + 1}/${postPage.totalPages}.`,
      });
    },
    [limit, postPage.totalCount, postPage.totalPages, showTransientNotice]
  );

  const setReplyPage = useCallback(
    (page: number) => {
      const nextPage = Math.max(1, Math.min(conversationPage.totalPages, page));
      const nextPageItems = paginateItems(conversationItems, {
        limit: state.replyPageSize,
        offset: offsetForPage(nextPage, state.replyPageSize),
      }).items;
      const firstItem = nextPageItems[0] ?? null;
      dispatch({
        type: "patch",
        patch: {
          replyPage: nextPage,
          focusedReplyIndex: firstItem?.replyIndex ?? -1,
        },
      });
      showTransientNotice({
        kind: "info",
        text: `Conversation page ${nextPage}/${conversationPage.totalPages}.`,
      });
    },
    [conversationItems, conversationPage.totalPages, showTransientNotice, state.replyPageSize]
  );

  const handleKeyPress = useCallback(
    (event: { attributes: { key: KeyLike } }) => {
      const rawKey = event.attributes.key;
      if (
        state.composerPickerTarget &&
        rawKey.name === "backspace" &&
        !rawKey.ctrl &&
        !rawKey.alt &&
        !rawKey.meta &&
        !rawKey.shift
      ) {
        dispatch({
          type: "patch",
          patch: {
            composerPickerQuery: deleteSearchQueryBackward(state.composerPickerQuery),
            composerPickerSelectedIndex: 0,
            composerPickerPristine: false,
          },
        });
        return;
      }

      const composeTextEditingActive =
        !state.composerPickerTarget &&
        ((state.view === "compose-post" && activeComposeFieldKind === "text") ||
          (state.view === "compose-subscription" && activeComposeFieldKind === "text"));

      if (composeTextEditingActive) {
        if (
          rawKey.name === "backspace" &&
          !rawKey.ctrl &&
          !rawKey.alt &&
          !rawKey.meta &&
          !rawKey.shift
        ) {
          if (state.view === "compose-post") {
            const field = state.postComposerField;
            const currentValue = state.postComposerDraft[field] ?? "";
            const next = deleteInputTextBackward({
              value: currentValue,
              cursorIndex: activePostComposerTextCursorIndex,
            });
            if (next.value !== currentValue) {
              updatePostComposerField(field, next.value, { cursorIndex: next.cursorIndex });
            } else {
              setPostComposerTextCursorIndices((current) => ({
                ...current,
                [field]: next.cursorIndex,
              }));
            }
          } else {
            const field = state.subscriptionComposerField;
            const currentValue = state.subscriptionComposerDraft[field] ?? "";
            const next = deleteInputTextBackward({
              value: currentValue,
              cursorIndex: activeSubscriptionComposerTextCursorIndex,
            });
            if (next.value !== currentValue) {
              updateSubscriptionComposerField(field, next.value, {
                cursorIndex: next.cursorIndex,
              });
            } else {
              setSubscriptionComposerTextCursorIndices((current) => ({
                ...current,
                [field]: next.cursorIndex,
              }));
            }
          }
          return;
        }

        if (rawKey.name === "left" && !rawKey.ctrl && !rawKey.alt && !rawKey.meta) {
          if (state.view === "compose-post") {
            setPostComposerTextCursorIndices((current) => ({
              ...current,
              [state.postComposerField]: moveInputCursor(
                state.postComposerDraft[state.postComposerField] ?? "",
                activePostComposerTextCursorIndex,
                -1
              ),
            }));
          } else {
            setSubscriptionComposerTextCursorIndices((current) => ({
              ...current,
              [state.subscriptionComposerField]: moveInputCursor(
                state.subscriptionComposerDraft[state.subscriptionComposerField] ?? "",
                activeSubscriptionComposerTextCursorIndex,
                -1
              ),
            }));
          }
          return;
        }

        if (rawKey.name === "right" && !rawKey.ctrl && !rawKey.alt && !rawKey.meta) {
          if (state.view === "compose-post") {
            setPostComposerTextCursorIndices((current) => ({
              ...current,
              [state.postComposerField]: moveInputCursor(
                state.postComposerDraft[state.postComposerField] ?? "",
                activePostComposerTextCursorIndex,
                1
              ),
            }));
          } else {
            setSubscriptionComposerTextCursorIndices((current) => ({
              ...current,
              [state.subscriptionComposerField]: moveInputCursor(
                state.subscriptionComposerDraft[state.subscriptionComposerField] ?? "",
                activeSubscriptionComposerTextCursorIndex,
                1
              ),
            }));
          }
          return;
        }
      }

      const command = resolveBrowseKeyCommand(
        {
          view: state.view,
          readerMode: state.readerMode,
          showShortcutsHelp: state.showShortcutsHelp,
          confirmDelete: Boolean(state.confirmDelete),
          confirmQuit: state.confirmQuit,
          confirmDiscard: Boolean(state.confirmDiscardTarget),
          gotoPageMode: state.gotoPageMode,
          searchMode: state.searchMode,
          reactionPickerMode: state.reactionPickerMode,
          searchBuilderActive: state.searchBuilderActive,
          busyOperationKind: state.busyOperationKind,
          hasActiveSearch: activeSearchQuery.length > 0,
          replyBody: state.replyBody,
          replySectionFocus: state.replySectionFocus,
          postPanelFocus: state.postPanelFocus,
          conversationFilterMode: state.conversationFilterMode,
          focusedReplyIndex: state.focusedReplyIndex,
          canQuoteReply: Boolean(state.bundle),
          hasSelectedPost: Boolean(selectedPost),
          hasBundle: Boolean(state.bundle),
          hasRefPost: activeRelations.length > 0,
          hasActiveReplyRefs: activeReplyRefs.length > 0 || activeRelations.length > 0,
          channelSelectedIndex: state.channelSelectedIndex,
          channelCount: channelStats.length + 1,
          postsLength: posts.length,
          selectedConversationIndex,
          conversationItemsLength: conversationItems.length,
          composeFieldKind: activeComposeFieldKind,
          composeFieldSupportsPicker: activeComposeFieldSupportsPicker,
          composePickerOpen: Boolean(state.composerPickerTarget),
          composeSuggestionCount: Math.min(
            9,
            composerPickerVisibleLimit,
            composerPickerItems.length
          ),
        },
        rawKey
      );

      switch (command.type) {
        case "terminate":
        case "quit":
          if (hasPendingWork && !state.confirmQuit) {
            dispatch({ type: "patch", patch: { confirmQuit: true } });
            dispatch({
              type: "setNotice",
              notice: {
                kind: "error",
                text: "Unsaved work will be lost. Press q or Ctrl+C again to exit, or Esc to stay.",
              },
            });
            return;
          }
          screen.terminate(0);
          return;
        case "cancelQuit":
          dispatch({ type: "patch", patch: { confirmQuit: false } });
          clearNotice();
          return;
        case "confirmDiscard":
          if (state.confirmDiscardTarget === "reply") {
            dispatch({
              type: "patch",
              patch: {
                view: "post",
                confirmDiscardTarget: null,
                replyBody: "",
                replyQuotes: [],
                replyFocusedQuoteId: null,
              },
            });
            clearNotice();
            return;
          }
          if (state.confirmDiscardTarget === "compose-post") {
            dispatch({
              type: "patch",
              patch: {
                view: "list",
                busyOperationKind: null,
                composerPickerTarget: null,
                composerPickerQuery: "",
                composerPickerSelectedIndex: 0,
                composerPickerPristine: false,
                confirmDiscardTarget: null,
              },
            });
            clearNotice();
            return;
          }
          if (state.confirmDiscardTarget === "compose-subscription") {
            dispatch({
              type: "patch",
              patch: {
                view: "channels",
                busyOperationKind: null,
                composerPickerTarget: null,
                composerPickerQuery: "",
                composerPickerSelectedIndex: 0,
                composerPickerPristine: false,
                confirmDiscardTarget: null,
              },
            });
            clearNotice();
            return;
          }
          return;
        case "cancelDiscard":
          dispatch({ type: "patch", patch: { confirmDiscardTarget: null } });
          clearNotice();
          return;
        case "closeShortcuts":
          dispatch({ type: "patch", patch: { confirmQuit: false } });
          dispatch({ type: "patch", patch: { showShortcutsHelp: false } });
          return;
        case "scrollShortcuts":
          scrollBy(shortcutsScrollRef.current, command.delta);
          return;
        case "confirmDelete":
          executeDelete();
          return;
        case "cancelDelete":
          dispatch({ type: "patch", patch: { confirmDelete: null } });
          clearNotice();
          return;
        case "closeReactionPicker":
          dispatch({
            type: "patch",
            patch: { reactionPickerMode: null, reactionPickerSelectedIndex: 0 },
          });
          clearNotice();
          return;
        case "reactionMove":
          dispatch({
            type: "patch",
            patch: {
              reactionPickerSelectedIndex: clampIndex(
                state.reactionPickerSelectedIndex + command.delta,
                availableReactions.length
              ),
            },
          });
          return;
        case "applyReaction": {
          if (!state.bundle || !reactionPickerTarget) {
            return;
          }

          const reactionIndex =
            command.index == null
              ? state.reactionPickerSelectedIndex
              : clampIndex(command.index, availableReactions.length);
          const reaction = availableReactions[reactionIndex];
          if (!reaction) {
            return;
          }

          void (async () => {
            try {
              await postService.createReaction({
                targetId: reactionPickerTarget.id,
                reaction,
                actor,
                session,
              });
              dispatch({
                type: "patch",
                patch: { reactionPickerMode: null, reactionPickerSelectedIndex: 0 },
              });
              refreshData("auto", state.bundle.post.id);
              showTransientNotice({
                kind: "info",
                text: `Added ${reaction} to ${reactionPickerTarget.label}.`,
              });
            } catch (error) {
              dispatch({
                type: "patch",
                patch: { reactionPickerMode: null, reactionPickerSelectedIndex: 0 },
              });
              dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
            }
          })();
          return;
        }
        case "closeGotoPage":
          dispatch({ type: "patch", patch: { gotoPageMode: null, gotoPageInput: "" } });
          clearNotice();
          return;
        case "applyGotoPage": {
          const targetPage = Number(state.gotoPageInput);
          if (!Number.isInteger(targetPage) || targetPage <= 0) {
            dispatch({
              type: "setNotice",
              notice: { kind: "error", text: "Page number must be a positive integer." },
            });
            return;
          }

          if (state.gotoPageMode === "list") {
            setListPage(targetPage);
          } else {
            setReplyPage(targetPage);
          }

          dispatch({ type: "patch", patch: { gotoPageMode: null, gotoPageInput: "" } });
          return;
        }
        case "closeSearch":
          dispatch({
            type: "patch",
            patch: {
              searchMode: false,
              searchBuilderActive: false,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
              searchDraftQuery: state.searchQuery,
            },
          });
          clearNotice();
          return;
        case "openSearchBuilder":
          pendingSearchShortcutRef.current = event.attributes.key.sequence === "/" ? "/" : null;
          dispatch({
            type: "patch",
            patch: {
              searchBuilderActive: true,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
            },
          });
          clearNotice();
          return;
        case "closeSearchBuilder":
          dispatch({
            type: "patch",
            patch: {
              searchBuilderActive: false,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
            },
          });
          return;
        case "searchBuilderSegment": {
          const segments: Array<"field" | "operator" | "value"> = ["field", "operator", "value"];
          const currentIndex = segments.indexOf(state.searchBuilderSegment);
          const next =
            segments[(currentIndex + command.delta + segments.length) % segments.length] ?? "field";
          dispatch({ type: "patch", patch: { searchBuilderSegment: next } });
          return;
        }
        case "searchBuilderCycle":
          if (state.searchBuilderSegment === "field") {
            const nextField = cycleSearchBuilderField(state.searchBuilderField, command.delta);
            dispatch({
              type: "patch",
              patch: {
                searchBuilderField: nextField,
                searchBuilderOperator:
                  SEARCH_BUILDER_FIELDS.find((entry) => entry.key === nextField)?.operators[0] ??
                  "=",
                searchBuilderValue: "",
                searchBuilderSelectedValueIndex: 0,
              },
            });
            return;
          }
          if (state.searchBuilderSegment === "operator") {
            dispatch({
              type: "patch",
              patch: {
                searchBuilderOperator: cycleSearchBuilderOperator(
                  state.searchBuilderField,
                  state.searchBuilderOperator,
                  command.delta
                ),
                searchBuilderSelectedValueIndex: 0,
              },
            });
            return;
          }
          dispatch({
            type: "patch",
            patch: {
              searchBuilderSelectedValueIndex: clampIndex(
                state.searchBuilderSelectedValueIndex + command.delta,
                searchBuilderValueSuggestions.length
              ),
            },
          });
          return;
        case "searchBuilderBackspace":
          if (state.searchBuilderSegment === "value" && state.searchBuilderValue.length > 0) {
            dispatch({
              type: "patch",
              patch: {
                searchBuilderValue: deleteSearchQueryBackward(state.searchBuilderValue),
                searchBuilderSelectedValueIndex: 0,
              },
            });
            return;
          }
          dispatch({
            type: "patch",
            patch: {
              searchBuilderActive: false,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
            },
          });
          return;
        case "applySearchBuilder": {
          if (state.searchBuilderSegment === "field") {
            dispatch({ type: "patch", patch: { searchBuilderSegment: "operator" } });
            return;
          }

          if (state.searchBuilderSegment === "operator") {
            dispatch({ type: "patch", patch: { searchBuilderSegment: "value" } });
            return;
          }

          const selectedSuggestion =
            searchBuilderValueSuggestions[
              Math.max(
                0,
                Math.min(
                  searchBuilderValueSuggestions.length - 1,
                  state.searchBuilderSelectedValueIndex
                )
              )
            ]?.value ?? null;
          const builderValue = state.searchBuilderValue.trim() || (selectedSuggestion ?? "");
          if (!builderValue) {
            dispatch({
              type: "setNotice",
              notice: { kind: "error", text: "Type or choose a value before adding this filter." },
            });
            return;
          }
          const token = buildSearchBuilderToken(
            state.searchBuilderField,
            state.searchBuilderOperator,
            builderValue
          );
          const nextQuery = state.searchDraftQuery.trim()
            ? `${state.searchDraftQuery.trimEnd()} ${token}`
            : token;
          dispatch({
            type: "patch",
            patch: {
              searchDraftQuery: nextQuery,
              searchBuilderActive: false,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
            },
          });
          showTransientNotice({ kind: "info", text: `Added filter ${token}.` });
          return;
        }
        case "applySearch":
          dispatch({
            type: "patch",
            patch: {
              searchMode: false,
              searchBuilderActive: false,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
              searchQuery: state.searchDraftQuery,
              searchDraftQuery: state.searchDraftQuery,
              listOffset: 0,
              selectedIndex: 0,
            },
          });
          refreshData("manual", undefined, {
            currentOffset: 0,
            searchQuery: state.searchDraftQuery,
          });
          return;
        case "searchComplete":
          dispatch({
            type: "patch",
            patch: {
              searchDraftQuery: hasSearchValueToken(state.searchDraftQuery)
                ? cycleSearchValueSuggestion(
                    state.searchDraftQuery,
                    availableSearchValues,
                    command.direction
                  )
                : cycleSearchQualifierSuggestion(state.searchDraftQuery, command.direction),
            },
          });
          return;
        case "searchBackspace":
          dispatch({
            type: "patch",
            patch: { searchDraftQuery: deleteSearchQueryBackward(state.searchDraftQuery) },
          });
          return;
        case "replyCancel":
          if (hasDirtyReplyDraft) {
            dispatch({ type: "patch", patch: { confirmDiscardTarget: "reply" } });
            dispatch({
              type: "setNotice",
              notice: {
                kind: "error",
                text: "Discard the current reply draft? Press Esc again to leave, or any other key to stay.",
              },
            });
            return;
          }
          dispatch({ type: "patch", patch: { view: "post" } });
          clearNotice();
          return;
        case "clearReplyQuotes":
          dispatch({
            type: "patch",
            patch: { replyQuotes: [], replyFocusedQuoteId: null, replySectionFocus: "editor" },
          });
          showTransientNotice({ kind: "info", text: "Selected quotes cleared." });
          return;
        case "replyFocusNext": {
          const order: Array<"quotes" | "preview" | "editor"> = ["quotes", "preview", "editor"];
          const available = order.filter((section) =>
            section === "editor" ? true : state.replyQuotes.length > 0
          );
          const currentIndex = available.indexOf(state.replySectionFocus);
          const next = available[(currentIndex + 1) % available.length] ?? "editor";
          dispatch({ type: "patch", patch: { replySectionFocus: next } });
          return;
        }
        case "replyFocusPrev": {
          const order: Array<"quotes" | "preview" | "editor"> = ["quotes", "preview", "editor"];
          const available = order.filter((section) =>
            section === "editor" ? true : state.replyQuotes.length > 0
          );
          const currentIndex = available.indexOf(state.replySectionFocus);
          const next =
            available[(currentIndex - 1 + available.length) % available.length] ?? "editor";
          dispatch({ type: "patch", patch: { replySectionFocus: next } });
          return;
        }
        case "replyMoveQuoteSelection": {
          if (state.replyQuotes.length === 0) {
            return;
          }
          const currentIndex = Math.max(
            0,
            state.replyQuotes.findIndex((quote) => quote.id === selectedReplyQuote?.id)
          );
          const nextIndex = clampIndex(currentIndex + command.delta, state.replyQuotes.length);
          const nextQuote = state.replyQuotes[nextIndex] ?? state.replyQuotes[0];
          dispatch({ type: "patch", patch: { replyFocusedQuoteId: nextQuote.id } });
          return;
        }
        case "replyPreviewScroll":
          scrollBy(replyQuotePreviewRef.current, command.delta);
          return;
        case "copyReplyDraft":
          copyToClipboard(state.replyBody);
          showTransientNotice({ kind: "info", text: "Copied reply draft to clipboard." });
          return;
        case "submitReply":
          if (state.replyBody.trim()) {
            submitReply();
          }
          return;
        case "composeOpenPicker":
          openComposerPicker();
          return;
        case "composeClosePicker":
          dispatch({
            type: "patch",
            patch: {
              composerPickerTarget: null,
              composerPickerQuery: "",
              composerPickerSelectedIndex: 0,
              composerPickerPristine: false,
            },
          });
          return;
        case "composeMovePicker":
          dispatch({
            type: "patch",
            patch: {
              composerPickerSelectedIndex: clampIndex(
                state.composerPickerSelectedIndex + command.delta,
                Math.max(1, composerPickerItems.length)
              ),
            },
          });
          return;
        case "composeApplyPicker": {
          const pickerIndex =
            command.index != null
              ? composerPickerPageStart + command.index
              : state.composerPickerSelectedIndex;
          const item = composerPickerItems[pickerIndex];
          if (!item || !state.composerPickerTarget) {
            return;
          }

          if (state.composerPickerTarget.composer === "post") {
            const field = state.composerPickerTarget.field;
            const nextValue = applyPostComposerSuggestion(
              field,
              state.postComposerDraft[field] ?? "",
              item.value
            );
            setPostComposerTextCursorIndices((current) => ({
              ...current,
              [field]: Array.from(nextValue).length,
            }));
            dispatch({
              type: "patch",
              patch: {
                composerPickerTarget: null,
                composerPickerQuery: "",
                composerPickerSelectedIndex: 0,
                composerPickerPristine: false,
                postComposerDraft: {
                  ...state.postComposerDraft,
                  [field]: nextValue,
                },
              },
            });
            return;
          }

          const field = state.composerPickerTarget.field;
          const nextValue = applySubscriptionComposerSuggestion(
            field,
            state.subscriptionComposerDraft[field] ?? "",
            item.value
          );
          setSubscriptionComposerTextCursorIndices((current) => ({
            ...current,
            [field]: Array.from(nextValue).length,
          }));
          dispatch({
            type: "patch",
            patch: {
              composerPickerTarget: null,
              composerPickerQuery: "",
              composerPickerSelectedIndex: 0,
              composerPickerPristine: false,
              subscriptionComposerDraft: {
                ...state.subscriptionComposerDraft,
                [field]: nextValue,
              },
            },
          });
          return;
        }
        case "composePostCancel":
          if (hasDirtyPostComposerDraft) {
            dispatch({ type: "patch", patch: { confirmDiscardTarget: "compose-post" } });
            dispatch({
              type: "setNotice",
              notice: {
                kind: "error",
                text: "Discard the current post draft? Press Esc again to leave, or any other key to stay.",
              },
            });
            return;
          }
          dispatch({
            type: "patch",
            patch: {
              view: "list",
              busyOperationKind: null,
              composerPickerTarget: null,
              composerPickerQuery: "",
              composerPickerSelectedIndex: 0,
              composerPickerPristine: false,
            },
          });
          clearNotice();
          return;
        case "composePostNextField": {
          const currentIndex = visiblePostComposerFields.indexOf(state.postComposerField);
          const nextIndex =
            (currentIndex + command.delta + visiblePostComposerFields.length) %
            visiblePostComposerFields.length;
          dispatch({
            type: "patch",
            patch: { postComposerField: visiblePostComposerFields[nextIndex] },
          });
          return;
        }
        case "composePostCycleOption": {
          const nextValue = cycleComposerOption(
            state.postComposerField,
            state.postComposerDraft,
            command.delta
          );
          if (nextValue == null) {
            return;
          }
          dispatch({
            type: "patch",
            patch: {
              postComposerDraft: {
                ...state.postComposerDraft,
                [state.postComposerField]: nextValue,
              },
            },
          });
          return;
        }
        case "submitPost":
          submitPost();
          return;
        case "composeSubscriptionCancel":
          if (hasDirtySubscriptionComposerDraft) {
            dispatch({
              type: "patch",
              patch: { confirmDiscardTarget: "compose-subscription" },
            });
            dispatch({
              type: "setNotice",
              notice: {
                kind: "error",
                text: "Discard the current subscription draft? Press Esc again to leave, or any other key to stay.",
              },
            });
            return;
          }
          dispatch({
            type: "patch",
            patch: {
              view: "channels",
              busyOperationKind: null,
              composerPickerTarget: null,
              composerPickerQuery: "",
              composerPickerSelectedIndex: 0,
              composerPickerPristine: false,
            },
          });
          clearNotice();
          return;
        case "composeSubscriptionNextField": {
          const currentIndex = SUBSCRIPTION_COMPOSER_FIELDS.indexOf(
            state.subscriptionComposerField
          );
          const nextIndex =
            (currentIndex + command.delta + SUBSCRIPTION_COMPOSER_FIELDS.length) %
            SUBSCRIPTION_COMPOSER_FIELDS.length;
          dispatch({
            type: "patch",
            patch: { subscriptionComposerField: SUBSCRIPTION_COMPOSER_FIELDS[nextIndex] },
          });
          return;
        }
        case "composeSubscriptionCycleOption": {
          const nextValue = cycleSubscriptionComposerOption(
            state.subscriptionComposerField,
            state.subscriptionComposerDraft,
            command.delta
          );
          if (nextValue == null) {
            return;
          }
          dispatch({
            type: "patch",
            patch: {
              subscriptionComposerDraft: {
                ...state.subscriptionComposerDraft,
                [state.subscriptionComposerField]: nextValue,
              },
            },
          });
          return;
        }
        case "submitSubscription":
          submitSubscription();
          return;
        case "toggleShortcuts":
          dispatch({ type: "patch", patch: { showShortcutsHelp: true } });
          return;
        case "cycleTheme": {
          const next = cycleThemeIndex(state.themeIndex, THEMES.length);
          dispatch({ type: "patch", patch: { themeIndex: next } });
          showTransientNotice({ kind: "info", text: `Theme: ${THEMES[next].name}` });
          return;
        }
        case "toggleAutoRefresh":
          toggleAutoRefresh();
          return;
        case "cycleListDisplayMode": {
          const next = nextValue(LIST_DISPLAY_MODES, state.listDisplayMode);
          dispatch({ type: "patch", patch: { listDisplayMode: next } });
          showTransientNotice({ kind: "info", text: `List view: ${next}.` });
          return;
        }
        case "manualRefresh":
          refreshData("manual");
          return;
        case "channelsMove":
          dispatch({
            type: "patch",
            patch: {
              channelSelectedIndex: clampIndex(
                state.channelSelectedIndex + command.delta,
                channelStats.length + 1
              ),
            },
          });
          return;
        case "channelsSelect":
          dispatch({
            type: "patch",
            patch: {
              channelFilter:
                state.channelSelectedIndex === 0
                  ? ALL_CHANNELS
                  : channelStats[state.channelSelectedIndex - 1].name,
              listOffset: 0,
              selectedIndex: 0,
              view: "list",
            },
          });
          clearNotice();
          return;
        case "channelsBack":
          dispatch({ type: "patch", patch: { view: "list" } });
          clearNotice();
          return;
        case "openPostComposer":
          pendingComposeShortcutRef.current = event.attributes.key.sequence || null;
          openPostComposer();
          clearNotice();
          return;
        case "openSubscriptionComposer":
          pendingComposeShortcutRef.current = event.attributes.key.sequence || null;
          openSubscriptionComposer();
          clearNotice();
          return;
        case "cycleChannelFilter": {
          const next = nextChannelFilter(channels, state.channelFilter);
          dispatch({
            type: "patch",
            patch: {
              channelFilter: next,
              listOffset: 0,
              selectedIndex: 0,
            },
          });
          showTransientNotice({
            kind: "info",
            text: next === ALL_CHANNELS ? "Showing all channels." : `Channel filter: #${next}.`,
          });
          return;
        }
        case "cycleSortMode": {
          const next = nextValue(SORT_MODES, state.sortMode);
          dispatch({ type: "patch", patch: { sortMode: next, listOffset: 0, selectedIndex: 0 } });
          showTransientNotice({ kind: "info", text: `Sort: ${next}.` });
          return;
        }
        case "listMove":
          dispatch({
            type: "patch",
            patch: { selectedIndex: clampIndex(state.selectedIndex + command.delta, posts.length) },
          });
          return;
        case "listPagePrev":
          setListPage(postPage.page - 1);
          return;
        case "listPageNext":
          setListPage(postPage.page + 1);
          return;
        case "openSelectedPost":
          if (selectedPost) {
            openPost(selectedPost.id);
          }
          return;
        case "deleteSelectedPost":
          if (selectedPost) {
            dispatch({
              type: "patch",
              patch: {
                confirmDelete: selectedPost,
                notice: {
                  kind: "error",
                  text: `Delete "${selectedPost.title}"? y confirm  |  any key cancel`,
                },
              },
            });
          }
          return;
        case "openChannels":
          dispatch({ type: "patch", patch: { view: "channels" } });
          clearNotice();
          return;
        case "clearSearch":
          dispatch({
            type: "patch",
            patch: {
              searchQuery: "",
              searchDraftQuery: "",
              listOffset: 0,
              selectedIndex: 0,
            },
          });
          refreshData("manual", undefined, { currentOffset: 0, searchQuery: "" });
          return;
        case "openSearch":
          pendingSearchShortcutRef.current = event.attributes.key.sequence === "/" ? "/" : null;
          dispatch({
            type: "patch",
            patch: {
              searchMode: true,
              searchBuilderActive: false,
              searchBuilderField: "tag",
              searchBuilderOperator: "=",
              searchBuilderValue: "",
              searchBuilderSelectedValueIndex: 0,
              searchBuilderSegment: "field",
              searchDraftQuery: state.searchQuery,
            },
          });
          clearNotice();
          return;
        case "openGotoPage":
          dispatch({
            type: "patch",
            patch: {
              gotoPageMode: command.mode,
              gotoPageInput: String(
                command.mode === "list" ? postPage.page : conversationPage.page
              ),
            },
          });
          clearNotice();
          return;
        case "cancelBusyOperation":
          dispatch({
            type: "patch",
            patch: { loading: false, refreshing: false, busyOperationKind: null },
          });
          showTransientNotice({ kind: "info", text: "Pending operation canceled." });
          return;
        case "openReader":
          dispatch({ type: "patch", patch: { view: "reader", postPanelFocus: "content" } });
          return;
        case "closeReader":
          dispatch({ type: "patch", patch: { view: "post", postPanelFocus: "index" } });
          refreshReadProgress();
          return;
        case "postFocus":
          dispatch({ type: "patch", patch: { postPanelFocus: command.focus } });
          return;
        case "postMoveConversation": {
          const nextIndex = clampIndex(
            absoluteConversationIndex + command.delta,
            conversationItems.length
          );
          const nextItem = conversationItems[nextIndex];
          if (nextItem) {
            dispatch({ type: "patch", patch: { focusedReplyIndex: nextItem.replyIndex } });
          }
          return;
        }
        case "postPagePrev":
          setReplyPage(conversationPage.page - 1);
          return;
        case "postPageNext":
          setReplyPage(conversationPage.page + 1);
          return;
        case "postScroll":
          scrollBy(postContentRef.current, command.delta);
          refreshReadProgress();
          return;
        case "readerScroll":
          scrollBy(postContentRef.current, command.delta);
          refreshReadProgress();
          return;
        case "copySelectedBody": {
          const text =
            state.focusedReplyIndex === -1
              ? (state.bundle?.post.body ?? "")
              : (state.bundle?.replies[state.focusedReplyIndex]?.body ?? "");
          if (text) {
            copyToClipboard(text);
            const label =
              state.focusedReplyIndex === -1 ? "post body" : `reply ${state.focusedReplyIndex + 1}`;
            showTransientNotice({ kind: "info", text: `Copied ${label} to clipboard.` });
          }
          return;
        }
        case "copyContextPack":
          if (state.bundle) {
            copyContextPack(state.bundle, conversationPage.items, actor);
            showTransientNotice({ kind: "info", text: "Copied thread context pack to clipboard." });
          }
          return;
        case "replyRefPrev": {
          const refs = state.focusedReplyIndex === -1 ? activeRelations : activeReplyRefs;
          if (refs.length > 0) {
            dispatch({
              type: "patch",
              patch: {
                activeReplyRefIndex: Math.max(0, state.activeReplyRefIndex - 1),
              },
            });
          } else {
            showTransientNotice({
              kind: "info",
              text: noReferencesMessage(state.focusedReplyIndex),
            });
          }
          return;
        }
        case "replyRefNext": {
          const refs = state.focusedReplyIndex === -1 ? activeRelations : activeReplyRefs;
          if (refs.length > 0) {
            dispatch({
              type: "patch",
              patch: {
                activeReplyRefIndex: Math.min(refs.length - 1, state.activeReplyRefIndex + 1),
              },
            });
          } else {
            showTransientNotice({
              kind: "info",
              text: noReferencesMessage(state.focusedReplyIndex),
            });
          }
          return;
        }
        case "openReferencedPost":
          if (activeRelation) {
            openPost(activeRelation.otherPostId);
            showTransientNotice({
              kind: "info",
              text: `Opened related post ${activeRelation.otherPostId}.`,
            });
          }
          return;
        case "openSelectedReplyRef": {
          if (state.focusedReplyIndex === -1 && activeRelation) {
            openPost(activeRelation.otherPostId);
            showTransientNotice({
              kind: "info",
              text: `Opened related post ${activeRelation.otherPostId}.`,
            });
            return;
          }

          if (!activeReplyRef || !state.bundle) {
            showTransientNotice({
              kind: "info",
              text: noReferencesMessage(state.focusedReplyIndex),
            });
            return;
          }

          if (activeReplyRef.kind === "post" && activeReplyRef.id === state.bundle.post.id) {
            dispatch({ type: "patch", patch: { focusedReplyIndex: -1, replyPage: 1 } });
            showTransientNotice({ kind: "info", text: "Opened quoted original post." });
            return;
          }

          const replyIndex = state.bundle.replies.findIndex(
            (reply) => reply.id === activeReplyRef.id
          );
          if (replyIndex >= 0) {
            const nextPage =
              Math.floor(
                resolveConversationSelection(conversationItems, replyIndex) / state.replyPageSize
              ) + 1;
            dispatch({
              type: "patch",
              patch: { focusedReplyIndex: replyIndex, replyPage: nextPage },
            });
            showTransientNotice({
              kind: "info",
              text: `Opened quoted ${activeReplyRef.label.toLowerCase()}.`,
            });
            return;
          }

          openPost(activeReplyRef.id);
          return;
        }
        case "cycleConversationFilter": {
          const next = nextValue(CONVERSATION_FILTER_MODES, state.conversationFilterMode);
          dispatch({ type: "patch", patch: { conversationFilterMode: next } });
          showTransientNotice({ kind: "info", text: `Conversation filter: ${next}.` });
          return;
        }
        case "cycleConversationSort": {
          const next = nextValue(CONVERSATION_SORT_MODES, state.conversationSortMode);
          dispatch({ type: "patch", patch: { conversationSortMode: next } });
          showTransientNotice({ kind: "info", text: `Conversation sort: ${next}.` });
          return;
        }
        case "deleteCurrentThread":
          if (state.bundle) {
            const target: BrowseListPost = {
              ...state.bundle.post,
              lastActivityAt: state.bundle.post.createdAt,
              replyCount: state.bundle.replies.length,
              reactionCount: state.bundle.reactions.length,
              lastReplyExcerpt: null,
              lastReplyActor: null,
            };
            dispatch({
              type: "patch",
              patch: {
                confirmDelete: target,
                notice: {
                  kind: "error",
                  text: `Delete "${state.bundle.post.title}"? y confirm  |  any key cancel`,
                },
              },
            });
          }
          return;
        case "backFromPost":
          if (state.focusedReplyIndex >= 0 && state.conversationFilterMode === "all") {
            dispatch({ type: "patch", patch: { focusedReplyIndex: -1 } });
          } else {
            dispatch({ type: "patch", patch: { view: "list" } });
          }
          clearNotice();
          return;
        case "startReply":
          dispatch({ type: "startReply" });
          return;
        case "openReactionPicker":
          dispatch({
            type: "patch",
            patch: {
              reactionPickerMode: state.focusedReplyIndex === -1 ? "post" : "reply",
              reactionPickerSelectedIndex: 0,
            },
          });
          clearNotice();
          return;
        case "toggleReplyQuote": {
          const quote = resolveFocusedQuote();
          if (!quote) {
            return;
          }

          const exists = state.replyQuotes.some((entry) => entry.id === quote.id);
          const nextQuotes = exists
            ? state.replyQuotes.filter((entry) => entry.id !== quote.id)
            : [...state.replyQuotes, quote].sort(
                (left, right) => left.replyIndex - right.replyIndex
              );
          const nextFocusedQuoteId = exists
            ? state.replyFocusedQuoteId === quote.id
              ? (nextQuotes[0]?.id ?? null)
              : state.replyFocusedQuoteId
            : (state.replyFocusedQuoteId ?? quote.id);
          const nextReplySectionFocus =
            nextQuotes.length === 0
              ? "editor"
              : state.replySectionFocus === "editor"
                ? state.replySectionFocus
                : "quotes";

          dispatch({
            type: "patch",
            patch: {
              replyQuotes: nextQuotes,
              replyFocusedQuoteId: nextFocusedQuoteId,
              replySectionFocus: nextReplySectionFocus,
            },
          });
          showTransientNotice({
            kind: "info",
            text: exists ? `Removed quote: ${quote.label}.` : `Selected quote: ${quote.label}.`,
          });
          return;
        }
        case "noop":
          return;
      }
    },
    [
      absoluteConversationIndex,
      activeComposeFieldKind,
      activeComposeFieldSupportsPicker,
      activePostComposerTextCursorIndex,
      activeSubscriptionComposerTextCursorIndex,
      actor,
      channelStats,
      channels,
      conversationItems,
      conversationPage.items,
      conversationPage.page,
      conversationPage.totalPages,
      executeDelete,
      hasPendingWork,
      postPage.page,
      postPage.totalPages,
      openPost,
      posts.length,
      availableSearchValues,
      availableReactions,
      searchBuilderValueSuggestions,
      postService,
      refreshData,
      refreshReadProgress,
      reactionPickerTarget,
      resolveFocusedQuote,
      screen,
      selectedConversationIndex,
      selectedPost,
      setListPage,
      setReplyPage,
      state,
      updatePostComposerField,
      updateSubscriptionComposerField,
      composerPickerHideDescriptions,
      composerPickerVisibleLimit,
      composerPickerPageStart,
      composerPickerItems.length,
      submitPost,
      submitSubscription,
      openComposerPicker,
      openPostComposer,
      openSubscriptionComposer,
      channelSuggestions,
    ]
  );

  const handleData = useCallback(
    (event: { attributes: { data: Uint8Array } }) => {
      const text = decoderRef.current.decode(event.attributes.data);
      if (!text) {
        return;
      }

      const composeChunk = consumeOpenSearchShortcut(text, pendingComposeShortcutRef.current);
      pendingComposeShortcutRef.current = null;
      if (!composeChunk) {
        return;
      }

      if (state.composerPickerTarget && !state.searchMode) {
        dispatch({
          type: "patch",
          patch: {
            composerPickerQuery: appendSearchQuery(
              state.composerPickerQuery,
              composeChunk,
              MAX_SEARCH_QUERY_LENGTH
            ),
            composerPickerSelectedIndex: 0,
            composerPickerPristine: false,
          },
        });
        return;
      }

      if (
        !state.composerPickerTarget &&
        state.view === "compose-post" &&
        activeComposeFieldKind === "text"
      ) {
        const field = state.postComposerField;
        const currentValue = state.postComposerDraft[field] ?? "";
        const next = insertInputTextAtCursor({
          value: currentValue,
          incoming: composeChunk,
          cursorIndex: activePostComposerTextCursorIndex,
        });
        if (next.value !== currentValue) {
          updatePostComposerField(field, next.value, { cursorIndex: next.cursorIndex });
        }
        return;
      }

      if (
        !state.composerPickerTarget &&
        state.view === "compose-subscription" &&
        activeComposeFieldKind === "text"
      ) {
        const field = state.subscriptionComposerField;
        const currentValue = state.subscriptionComposerDraft[field] ?? "";
        const next = insertInputTextAtCursor({
          value: currentValue,
          incoming: composeChunk,
          cursorIndex: activeSubscriptionComposerTextCursorIndex,
        });
        if (next.value !== currentValue) {
          updateSubscriptionComposerField(field, next.value, {
            cursorIndex: next.cursorIndex,
          });
        }
        return;
      }

      if (!state.searchMode) {
        return;
      }

      const chunk = consumeOpenSearchShortcut(composeChunk, pendingSearchShortcutRef.current);
      pendingSearchShortcutRef.current = null;
      if (!chunk) {
        return;
      }

      if (state.searchBuilderActive) {
        if (state.searchBuilderSegment !== "value") {
          return;
        }

        dispatch({
          type: "patch",
          patch: {
            searchBuilderValue: appendSearchQuery(
              state.searchBuilderValue,
              chunk,
              MAX_SEARCH_QUERY_LENGTH
            ),
            searchBuilderSelectedValueIndex: 0,
          },
        });
        return;
      }

      dispatch({
        type: "patch",
        patch: {
          searchDraftQuery: appendSearchQuery(
            state.searchDraftQuery,
            chunk,
            MAX_SEARCH_QUERY_LENGTH
          ),
        },
      });
    },
    [
      activeComposeFieldKind,
      activePostComposerTextCursorIndex,
      activeSubscriptionComposerTextCursorIndex,
      state.searchBuilderActive,
      state.searchBuilderSegment,
      state.searchBuilderSelectedValueIndex,
      state.searchBuilderValue,
      state.composerPickerQuery,
      state.searchDraftQuery,
      state.composerPickerTarget,
      state.postComposerDraft,
      state.postComposerField,
      state.searchMode,
      state.subscriptionComposerDraft,
      state.subscriptionComposerField,
      state.view,
      updatePostComposerField,
      updateSubscriptionComposerField,
    ]
  );

  return {
    rootRef,
    onKeyPress: handleKeyPress,
    onData: handleData,
    theme,
    view: state.view,
    channelFilter: state.channelFilter,
    bundle: state.bundle,
    focusedReplyIndex: state.focusedReplyIndex,
    sortMode: state.sortMode,
    autoRefreshEnabled: state.autoRefreshEnabled,
    refreshMs,
    posts,
    postPage,
    loading: state.loading,
    refreshing: state.refreshing,
    autoRefreshCountdownMs,
    channelStats,
    rawPosts: state.rawPosts,
    changedPostIds: state.changedPostIds,
    channelSelectedIndex: state.channelSelectedIndex,
    channelItemRefs,
    selectedIndex: state.selectedIndex,
    listItemRefs,
    now,
    actor,
    conversationItems: conversationPage.items,
    conversationPage,
    conversationFilterMode: state.conversationFilterMode,
    conversationSortMode: state.conversationSortMode,
    focusedReplyRefs,
    postScrollRef,
    postContentRef,
    postPanelFocus: state.postPanelFocus,
    activeReplyRefs,
    activeRelations,
    activeReplyRefIndex: state.activeReplyRefIndex,
    listDisplayMode: state.listDisplayMode,
    readProgressLabel: state.readProgressLabel,
    replyBody: state.replyBody,
    replyQuotes: state.replyQuotes,
    selectedReplyQuote,
    replyFocusedQuoteId: state.replyFocusedQuoteId,
    replyInputRef,
    replyQuotesListRef,
    replyQuotePreviewRef,
    replyQuoteItemRefs,
    onReplyBodyChange: (value: string) => dispatch({ type: "setReplyBody", value }),
    replySectionFocus: state.replySectionFocus,
    postComposerDraft: state.postComposerDraft,
    postComposerField: state.postComposerField,
    postComposerProgress: `${Math.max(1, visiblePostComposerFields.indexOf(state.postComposerField) + 1)}/${visiblePostComposerFields.length}`,
    postComposerTextCursorIndex: activePostComposerTextCursorIndex,
    postComposerInputRef,
    postComposerFieldItemRefs,
    onPostComposerFieldChange: updatePostComposerField,
    postComposerRefSuggestionDetails,
    subscriptionComposerDraft: state.subscriptionComposerDraft,
    subscriptionComposerField: state.subscriptionComposerField,
    subscriptionComposerProgress: `${Math.max(1, SUBSCRIPTION_COMPOSER_FIELDS.indexOf(state.subscriptionComposerField) + 1)}/${SUBSCRIPTION_COMPOSER_FIELDS.length}`,
    subscriptionComposerTextCursorIndex: activeSubscriptionComposerTextCursorIndex,
    subscriptionComposerInputRef,
    subscriptionComposerFieldItemRefs,
    onSubscriptionComposerFieldChange: updateSubscriptionComposerField,
    composerPickerTitle: state.composerPickerTarget
      ? state.composerPickerTarget.composer === "post"
        ? `Choose ${state.composerPickerTarget.field}`
        : `Choose ${state.composerPickerTarget.field}`
      : "",
    composerPickerSubtitle: state.composerPickerTarget
      ? state.composerPickerTarget.composer === "post"
        ? "Search known values and press Enter to apply."
        : "Search known values and press Enter to apply."
      : "",
    composerPickerItems,
    composerPickerOpen: Boolean(state.composerPickerTarget),
    composerPickerQuery: state.composerPickerQuery,
    composerPickerSelectedIndex: state.composerPickerSelectedIndex,
    composerPickerVisibleLimit,
    composerPickerHideDescriptions,
    composerPickerInputRef,
    onComposerPickerQueryChange: (value: string) =>
      dispatch({
        type: "patch",
        patch: {
          composerPickerQuery: value,
          composerPickerSelectedIndex: 0,
          composerPickerPristine: false,
        },
      }),
    searchMode: state.searchMode,
    reactionPickerMode: state.reactionPickerMode,
    reactionPickerSelectedIndex: state.reactionPickerSelectedIndex,
    reactionPickerTargetLabel: reactionPickerTarget?.label ?? "selected item",
    availableReactions,
    searchBuilderActive: state.searchBuilderActive,
    searchBuilderField: state.searchBuilderField,
    searchBuilderOperator: state.searchBuilderOperator,
    searchBuilderValue: state.searchBuilderValue,
    searchBuilderSelectedValueIndex: state.searchBuilderSelectedValueIndex,
    searchBuilderSegment: state.searchBuilderSegment,
    searchQuery: state.searchDraftQuery,
    searchMatchQuery: activeSearchTextQuery,
    activeSearchQuery,
    searchValueSuggestions,
    searchBuilderValueSuggestions,
    gotoPageMode: state.gotoPageMode,
    gotoPageInput: state.gotoPageInput,
    gotoPageInputRef,
    onGotoPageInputChange: (value: string) =>
      dispatch({ type: "patch", patch: { gotoPageInput: value.replace(/[^\d]/g, "") } }),
    notice: state.notice,
    selectedConversationIndex,
    showShortcutsHelp: state.showShortcutsHelp,
    shortcutsScrollRef,
    appVersion: pkg.version,
    terminalWidth,
    terminalHeight,
    busyOperationKind: state.busyOperationKind,
    showMoreAbove: state.view === "list" && state.selectedIndex > 0,
    showMoreBelow: state.view === "list" && state.selectedIndex < Math.max(0, posts.length - 1),
    channelSuggestions,
  };
}

function scrollBy(element: TermElement | null, delta: number): void {
  if (!element) {
    return;
  }

  element.triggerUpdates();
  element.scrollTop = Math.max(0, element.scrollTop + delta);
}

function orderedUniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

function summarizeRelation(
  relation: ReadPostBundle["relations"][number],
  currentPostId: string,
  postDetails: Record<string, string>,
  relationDescriptions: Record<string, string>
): BrowseRelationSummary {
  const outgoing = relation.fromPostId === currentPostId;
  const otherPostId = outgoing ? relation.toPostId : relation.fromPostId;
  const detail = postDetails[otherPostId];
  const direction = outgoing ? "outgoing" : "incoming";
  const arrow = outgoing ? "->" : "<-";

  return {
    relationId: relation.id,
    relationType: relation.relationType,
    otherPostId,
    direction,
    description: relationDescriptions[relation.relationType] || undefined,
    label: detail
      ? `${relation.relationType} ${arrow} ${otherPostId} · ${detail}`
      : `${relation.relationType} ${arrow} ${otherPostId}`,
  };
}

function noReferencesMessage(focusedReplyIndex: number): string {
  return focusedReplyIndex === -1
    ? "No related posts on this thread."
    : "No quote references on this reply.";
}

function cycleComposerOption(
  field: ReturnType<typeof createInitialBrowseState>["postComposerField"],
  draft: ReturnType<typeof createInitialBrowseState>["postComposerDraft"],
  delta: 1 | -1
): string | null {
  const options =
    field === "severity"
      ? ["", ...SEVERITIES]
      : field === "blocking" || field === "pinned"
        ? ["", "true", "false"]
        : null;

  if (!options) {
    return null;
  }

  const currentValue = draft[field].trim();
  const currentIndex = Math.max(0, options.indexOf(currentValue));
  return options[(currentIndex + delta + options.length) % options.length] ?? options[0];
}

function cycleSubscriptionComposerOption(
  field: ReturnType<typeof createInitialBrowseState>["subscriptionComposerField"],
  draft: ReturnType<typeof createInitialBrowseState>["subscriptionComposerDraft"],
  delta: 1 | -1
): string | null {
  if (field !== "mode") {
    return null;
  }

  const options = ["subscribe", "unsubscribe"];
  const currentIndex = Math.max(0, options.indexOf(draft.mode.trim()));
  return options[(currentIndex + delta + options.length) % options.length] ?? options[0];
}
