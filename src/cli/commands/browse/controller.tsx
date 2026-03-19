import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { TermElement, TermInput } from "terminosaurus";
import { useScreen } from "terminosaurus/react";
import pkg from "../../../../package.json" with { type: "json" };

import type { ReadPostBundle } from "../../../domain/post.js";
import type { BrowseAppProps, BrowseListPost, BrowseSortMode, KeyLike, ReplyQuote } from "./types.js";
import { CONVERSATION_FILTER_MODES, CONVERSATION_SORT_MODES, LIST_DISPLAY_MODES, SORT_MODES } from "./types.js";
import { BrowseScreen } from "./components/BrowseScreen.js";
import { copyContextPack, copyToClipboard } from "./clipboard.js";
import { submitBrowseReply, refreshBrowseData } from "./data.js";
import { buildReadProgressLabel, formatRefreshClock, toMessage } from "./formatters.js";
import { resolveBrowseKeyCommand } from "./keybindings.js";
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
  resolveConversationSelection
} from "./selectors.js";
import { browseReducer, clampIndex, createInitialBrowseState, cycleThemeIndex } from "./state.js";
import { THEMES } from "./theme.js";

const INFO_NOTICE_TTL_MS = 2500;
const MIN_REFRESH_VISIBLE_MS = 600;

export function BrowseApp(props: BrowseAppProps) {
  const screen = useScreen();
  const controller = useBrowseController(props, screen);
  return <BrowseScreen {...controller} />;
}

function useBrowseController(
  { postService, replyService, baseFilters, initialChannelFilter, limit, actor, session, refreshMs, initialAutoRefresh, initialPostId, initialSearchQuery }: BrowseAppProps,
  screen: ReturnType<typeof useScreen>
) {
  const rootRef = useRef<TermElement | null>(null);
  const listItemRefs = useRef<Array<TermElement | null>>([]);
  const channelItemRefs = useRef<Array<TermElement | null>>([]);
  const postScrollRef = useRef<TermElement | null>(null);
  const postContentRef = useRef<TermElement | null>(null);
  const shortcutsScrollRef = useRef<TermElement | null>(null);
  const replyInputRef = useRef<TermInput | null>(null);
  const searchInputRef = useRef<TermInput | null>(null);
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
  const initialOpenAttemptedRef = useRef(false);
  const nextAutoRefreshAtRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRequestIdRef = useRef(0);
  const [autoRefreshNowMs, setAutoRefreshNowMs] = useState(() => Date.now());

  const [state, dispatch] = useReducer(
    browseReducer,
    createInitialBrowseState({ initialChannelFilter, initialAutoRefresh, initialSearchQuery })
  );

  const theme = THEMES[state.themeIndex];
  const channels = useMemo(() => listChannels(state.rawPosts), [state.rawPosts]);
  const channelStats = useMemo(() => buildChannelStats(state.rawPosts), [state.rawPosts]);
  const postPage = useMemo(
    () => filterAndSortPosts(state.rawPosts, { channelFilter: state.channelFilter, sortMode: state.sortMode, limit, offset: state.listOffset }),
    [limit, state.channelFilter, state.listOffset, state.rawPosts, state.sortMode]
  );
  const posts = postPage.items;
  const selectedPost = posts[state.selectedIndex] ?? null;
  const conversationItems = useMemo(
    () => state.bundle ? buildConversationItems(state.bundle, { filterMode: state.conversationFilterMode, sortMode: state.conversationSortMode }) : [],
    [state.bundle, state.conversationFilterMode, state.conversationSortMode]
  );
  const absoluteConversationIndex = useMemo(
    () => resolveConversationSelection(conversationItems, state.focusedReplyIndex),
    [conversationItems, state.focusedReplyIndex]
  );
  const conversationPage = useMemo(
    () => paginateItems(conversationItems, { limit: state.replyPageSize, offset: offsetForPage(state.replyPage, state.replyPageSize) }),
    [conversationItems, state.replyPage, state.replyPageSize]
  );
  const selectedConversationIndex = useMemo(
    () => {
      const pageIndex = conversationPage.items.findIndex((item) => item.replyIndex === state.focusedReplyIndex);
      return pageIndex >= 0 ? pageIndex : 0;
    },
    [conversationPage.items, state.focusedReplyIndex]
  );
  const now = useMemo(() => new Date(), [state.lastRefreshAt]);
  const terminalWidth = process.stdout.columns ?? 120;
  const autoRefreshCountdownMs = useMemo(() => {
    if (!state.autoRefreshEnabled || state.view === "reply" || nextAutoRefreshAtRef.current == null) {
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

  const refreshReadProgress = useCallback(() => {
    const element = postContentRef.current;
    if (!element) {
      dispatch({ type: "patch", patch: { readProgressLabel: "[100% read]" } });
      return;
    }

    dispatch({
      type: "patch",
      patch: {
        readProgressLabel: buildReadProgressLabel(element.scrollTop, element.scrollHeight, element.offsetHeight)
      }
    });
  }, []);

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

  const showTransientNotice = useCallback((notice: NonNullable<ReturnType<typeof createInitialBrowseState>["notice"]>, ttlMs = INFO_NOTICE_TTL_MS) => {
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
  }, []);

  const finishRefresh = useCallback((requestId: number, patch: Partial<ReturnType<typeof createInitialBrowseState>>, delayMs: number) => {
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
  }, []);

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
        patch: reason === "initial" ? { loading: true } : { refreshing: true }
      });

      try {
        // Use refs for the currently open bundle/filter/sort so refresh and
        // auto-refresh callbacks can preserve UI context without stale closures.
        const result = refreshBrowseData({
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
          focusedId: focusedId ?? selectedPostIdRef.current ?? undefined
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
          notice: noticeRef.current
        };
        const delayMs = reason === "initial" ? 0 : Math.max(0, MIN_REFRESH_VISIBLE_MS - (Date.now() - startedAt));
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
            text: bundleRef.current ? `Open post is no longer available. ${toMessage(error)}` : toMessage(error)
          },
          changedPostIds: [],
          loading: false,
          refreshing: false
        };
        const delayMs = reason === "initial" ? 0 : Math.max(0, MIN_REFRESH_VISIBLE_MS - (Date.now() - startedAt));
        finishRefresh(requestId, patch, delayMs);
      }
    },
    [baseFilters, finishRefresh, limit, postService, showTransientNotice]
  );

  const openPost = useCallback(
    (postId: string) => {
      try {
        if (session) {
          postService.markRead(session, [postId]);
        }
        const nextBundle = postService.getPost(postId);
        dispatch({ type: "openBundle", bundle: nextBundle });
      } catch (error) {
        dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
      }
    },
    [postService, session]
  );

  const toggleAutoRefresh = useCallback(() => {
    const next = !state.autoRefreshEnabled;
    dispatch({
      type: "patch",
      patch: {
        autoRefreshEnabled: next
      }
    });
    showTransientNotice({
      kind: "info",
      text: next ? `Auto refresh enabled.` : "Auto refresh paused."
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

    try {
      submitBrowseReply(replyService, {
        postId: state.bundle.post.id,
        body: state.replyBody,
        actor,
        quote: state.replyQuote
      });
      dispatch({ type: "patch", patch: { replyBody: "", replyQuote: null, view: "post" } });
      refreshData("reply", state.bundle.post.id);
    } catch (error) {
      dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
    }
  }, [actor, refreshData, replyService, state.bundle, state.replyBody, state.replyQuote]);

  const executeDelete = useCallback(() => {
    if (!state.confirmDelete) {
      return;
    }

    try {
      postService.deletePost(state.confirmDelete.id);
      const shouldCloseBundle = state.bundle?.post.id === state.confirmDelete.id;
      dispatch({
        type: "patch",
        patch: {
          confirmDelete: null,
          bundle: shouldCloseBundle ? null : state.bundle,
          view: shouldCloseBundle ? "list" : state.view,
          notice: { kind: "info", text: `Deleted: ${state.confirmDelete.title} (${state.confirmDelete.id})` }
        }
      });
      refreshData("manual");
    } catch (error) {
      dispatch({
        type: "patch",
        patch: {
          confirmDelete: null,
          notice: { kind: "error", text: toMessage(error) }
        }
      });
    }
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
      searchInputRef.current?.focus();
      return;
    }

    if (state.gotoPageMode) {
      gotoPageInputRef.current?.focus();
      return;
    }

    if (state.view === "reply") {
      replyInputRef.current?.focus();
      return;
    }

    rootRef.current?.focus();
  }, [state.gotoPageMode, state.searchMode, state.view]);

  useEffect(() => {
    if (state.view === "list") {
      listItemRefs.current[state.selectedIndex]?.scrollIntoView({ alignY: "auto", forceY: true });
    }
  }, [posts.length, state.selectedIndex, state.view]);

  useEffect(() => {
    if (state.view === "channels") {
      channelItemRefs.current[state.channelSelectedIndex]?.scrollIntoView({ alignY: "auto", forceY: true });
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
      focusedReplyRefs.current[selectedConversationIndex]?.scrollIntoView({ alignY: "auto", forceY: true });
      if (postContentRef.current) {
        postContentRef.current.scrollTop = 0;
      }
      refreshReadProgress();
    }
  }, [refreshReadProgress, selectedConversationIndex, state.view]);

  useEffect(() => {
    if (state.view !== "post") {
      return;
    }

    if (conversationItems.length === 0) {
      dispatch({ type: "patch", patch: { focusedReplyIndex: -1, replyPage: 1 } });
      return;
    }

    const currentExists = conversationItems.some((item) => item.replyIndex === state.focusedReplyIndex);
    const nextFocusedReplyIndex = currentExists ? state.focusedReplyIndex : conversationItems[0].replyIndex;
    const nextPage = Math.floor(resolveConversationSelection(conversationItems, nextFocusedReplyIndex) / state.replyPageSize) + 1;

    if (!currentExists || nextPage !== state.replyPage) {
      dispatch({ type: "patch", patch: { focusedReplyIndex: nextFocusedReplyIndex, replyPage: nextPage } });
    }
  }, [conversationItems, state.focusedReplyIndex, state.replyPage, state.replyPageSize, state.view]);

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
    if (!state.autoRefreshEnabled || state.view === "reply") {
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
    if (!state.autoRefreshEnabled || state.view === "reply") {
      return;
    }

    setAutoRefreshNowMs(Date.now());
    const tick = setInterval(() => {
      setAutoRefreshNowMs(Date.now());
    }, 1000);

    return () => clearInterval(tick);
  }, [state.autoRefreshEnabled, state.view]);

  const setListPage = useCallback((page: number) => {
    const nextOffset = clampOffset(offsetForPage(page, limit), postPage.totalCount, limit);
    dispatch({
      type: "patch",
      patch: {
        listOffset: nextOffset,
        selectedIndex: 0
      }
    });
    showTransientNotice({ kind: "info", text: `Showing ${page < 1 ? 1 : Math.floor(nextOffset / limit) + 1}/${postPage.totalPages}.` });
  }, [limit, postPage.totalCount, postPage.totalPages, showTransientNotice]);

  const setReplyPage = useCallback((page: number) => {
    const nextPage = Math.max(1, Math.min(conversationPage.totalPages, page));
    const nextPageItems = paginateItems(conversationItems, {
      limit: state.replyPageSize,
      offset: offsetForPage(nextPage, state.replyPageSize)
    }).items;
    const firstItem = nextPageItems[0] ?? null;
    dispatch({
      type: "patch",
      patch: {
        replyPage: nextPage,
        focusedReplyIndex: firstItem?.replyIndex ?? -1
      }
    });
    showTransientNotice({ kind: "info", text: `Conversation page ${nextPage}/${conversationPage.totalPages}.` });
  }, [conversationItems, conversationPage.totalPages, showTransientNotice, state.replyPageSize]);

  const handleKeyPress = useCallback((event: { attributes: { key: KeyLike } }) => {
    const command = resolveBrowseKeyCommand(
      {
        view: state.view,
        showShortcutsHelp: state.showShortcutsHelp,
        confirmDelete: Boolean(state.confirmDelete),
        gotoPageMode: state.gotoPageMode,
        searchMode: state.searchMode,
        replyBody: state.replyBody,
        postPanelFocus: state.postPanelFocus,
        conversationFilterMode: state.conversationFilterMode,
        focusedReplyIndex: state.focusedReplyIndex,
        canQuoteReply: state.focusedReplyIndex >= 0,
        hasSelectedPost: Boolean(selectedPost),
        hasBundle: Boolean(state.bundle),
        hasRefPost: Boolean(state.bundle?.post.refId),
        channelSelectedIndex: state.channelSelectedIndex,
        channelCount: channelStats.length + 1,
        postsLength: posts.length,
        selectedConversationIndex,
        conversationItemsLength: conversationItems.length
      },
      event.attributes.key
    );

    switch (command.type) {
      case "terminate":
      case "quit":
        screen.terminate(0);
        return;
      case "closeShortcuts":
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
      case "closeGotoPage":
        dispatch({ type: "patch", patch: { gotoPageMode: null, gotoPageInput: "" } });
        clearNotice();
        return;
      case "applyGotoPage": {
        const targetPage = Number(state.gotoPageInput);
        if (!Number.isInteger(targetPage) || targetPage <= 0) {
          dispatch({ type: "setNotice", notice: { kind: "error", text: "Page number must be a positive integer." } });
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
          patch: { searchMode: false, searchDraftQuery: state.searchQuery }
        });
        clearNotice();
        return;
      case "applySearch":
        dispatch({
          type: "patch",
          patch: {
            searchMode: false,
            searchQuery: state.searchDraftQuery,
            searchDraftQuery: state.searchDraftQuery,
            listOffset: 0,
            selectedIndex: 0
          }
        });
        refreshData("manual", undefined, { currentOffset: 0, searchQuery: state.searchDraftQuery });
        return;
      case "replyCancel":
        dispatch({ type: "patch", patch: { view: "post" } });
        clearNotice();
        return;
      case "clearReplyQuote":
        dispatch({ type: "patch", patch: { replyQuote: null } });
        showTransientNotice({ kind: "info", text: "Quote cleared." });
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
          patch: { channelSelectedIndex: clampIndex(state.channelSelectedIndex + command.delta, channelStats.length + 1) }
        });
        return;
      case "channelsSelect":
        dispatch({
          type: "patch",
          patch: {
            channelFilter: state.channelSelectedIndex === 0 ? "__all__" : channelStats[state.channelSelectedIndex - 1].name,
            listOffset: 0,
            selectedIndex: 0,
            view: "list"
          }
        });
        clearNotice();
        return;
      case "channelsBack":
        dispatch({ type: "patch", patch: { view: "list" } });
        clearNotice();
        return;
      case "cycleChannelFilter": {
        const next = nextChannelFilter(channels, state.channelFilter);
        dispatch({
          type: "patch",
          patch: {
            channelFilter: next,
            listOffset: 0,
            selectedIndex: 0
          }
        });
        showTransientNotice({ kind: "info", text: next === "__all__" ? "Showing all channels." : `Channel filter: #${next}.` });
        return;
      }
      case "cycleSortMode": {
        const next = nextValue(SORT_MODES, state.sortMode);
        dispatch({ type: "patch", patch: { sortMode: next, listOffset: 0, selectedIndex: 0 } });
        showTransientNotice({ kind: "info", text: `Sort: ${next}.` });
        return;
      }
      case "listMove":
        dispatch({ type: "patch", patch: { selectedIndex: clampIndex(state.selectedIndex + command.delta, posts.length) } });
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
              notice: { kind: "error", text: `Delete "${selectedPost.title}"? y confirm  |  any key cancel` }
            }
          });
        }
        return;
      case "openChannels":
        dispatch({ type: "patch", patch: { view: "channels" } });
        clearNotice();
        return;
      case "openSearch":
        dispatch({
          type: "patch",
          patch: { searchMode: true, searchDraftQuery: state.searchQuery }
        });
        clearNotice();
        return;
      case "openGotoPage":
        dispatch({
          type: "patch",
          patch: {
            gotoPageMode: command.mode,
            gotoPageInput: String(command.mode === "list" ? postPage.page : conversationPage.page)
          }
        });
        clearNotice();
        return;
      case "postFocus":
        dispatch({ type: "patch", patch: { postPanelFocus: command.focus } });
        return;
      case "postMoveConversation": {
        const nextIndex = clampIndex(absoluteConversationIndex + command.delta, conversationItems.length);
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
      case "copySelectedBody": {
        const text = state.focusedReplyIndex === -1
          ? state.bundle?.post.body ?? ""
          : state.bundle?.replies[state.focusedReplyIndex]?.body ?? "";
        if (text) {
          copyToClipboard(text);
          const label = state.focusedReplyIndex === -1 ? "post body" : `reply ${state.focusedReplyIndex + 1}`;
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
      case "openReferencedPost":
        if (state.bundle?.post.refId) {
          openPost(state.bundle.post.refId);
        }
        return;
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
            lastReplyActor: null
          };
          dispatch({
            type: "patch",
            patch: {
              confirmDelete: target,
              notice: { kind: "error", text: `Delete "${state.bundle.post.title}"? y confirm  |  any key cancel` }
            }
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
      case "startReplyWithQuote": {
        const selectedReply = state.bundle?.replies[state.focusedReplyIndex];
        if (selectedReply) {
          const quote: ReplyQuote = {
            text: selectedReply.body,
            author: selectedReply.actor ?? "unknown",
            replyIndex: state.focusedReplyIndex,
            replyId: selectedReply.id
          };
          dispatch({ type: "startReplyWithQuote", quote });
        }
        return;
      }
      case "noop":
        return;
    }
  }, [
    absoluteConversationIndex,
    actor,
    channelStats,
    channels,
    conversationItems,
    conversationPage.items,
    conversationPage.page,
    conversationPage.totalPages,
    executeDelete,
    postPage.page,
    postPage.totalPages,
    openPost,
    posts.length,
    refreshData,
    refreshReadProgress,
    screen,
    selectedConversationIndex,
    selectedPost,
    setListPage,
    setReplyPage,
    state
  ]);

  return {
    rootRef,
    onKeyPress: handleKeyPress,
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
    listDisplayMode: state.listDisplayMode,
    readProgressLabel: state.readProgressLabel,
    replyBody: state.replyBody,
    replyQuote: state.replyQuote,
    replyInputRef,
    onReplyBodyChange: (value: string) => dispatch({ type: "setReplyBody", value }),
    searchMode: state.searchMode,
    searchQuery: state.searchDraftQuery,
    searchInputRef,
    onSearchQueryChange: (value: string) => dispatch({ type: "patch", patch: { searchDraftQuery: value } }),
    gotoPageMode: state.gotoPageMode,
    gotoPageInput: state.gotoPageInput,
    gotoPageInputRef,
    onGotoPageInputChange: (value: string) => dispatch({ type: "patch", patch: { gotoPageInput: value.replace(/[^\d]/g, "") } }),
    notice: state.notice,
    selectedConversationIndex,
    showShortcutsHelp: state.showShortcutsHelp,
    shortcutsScrollRef,
    appVersion: pkg.version,
    terminalWidth
  };
}

function scrollBy(element: TermElement | null, delta: number): void {
  if (!element) {
    return;
  }

  element.scrollTop = Math.max(0, element.scrollTop + delta);
}
