import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { TermElement, TermInput } from "terminosaurus";
import { useScreen } from "terminosaurus/react";

import type { ReadPostBundle } from "../../../domain/post.js";
import type { BrowseAppProps, BrowseListPost, BrowseSortMode, KeyLike } from "./types.js";
import { CONVERSATION_FILTER_MODES, CONVERSATION_SORT_MODES, SORT_MODES } from "./types.js";
import { BrowseScreen } from "./components/BrowseScreen.js";
import { copyToClipboard } from "./clipboard.js";
import { submitBrowseReply, refreshBrowseData } from "./data.js";
import { buildReadProgressLabel, formatRefreshClock, toMessage } from "./formatters.js";
import { resolveBrowseKeyCommand } from "./keybindings.js";
import { buildBrowseFilters, buildChannelStats, buildConversationItems, filterAndSortPosts, listChannels, nextChannelFilter, nextValue, resolveConversationSelection } from "./selectors.js";
import { browseReducer, clampIndex, createInitialBrowseState, cycleThemeIndex } from "./state.js";
import { THEMES } from "./theme.js";

export function BrowseApp(props: BrowseAppProps) {
  const screen = useScreen();
  const controller = useBrowseController(props, screen);
  return <BrowseScreen {...controller} />;
}

function useBrowseController(
  { postService, replyService, baseFilters, initialChannelFilter, limit, actor, refreshMs, initialAutoRefresh, initialPostId }: BrowseAppProps,
  screen: ReturnType<typeof useScreen>
) {
  const rootRef = useRef<TermElement | null>(null);
  const listItemRefs = useRef<Array<TermElement | null>>([]);
  const channelItemRefs = useRef<Array<TermElement | null>>([]);
  const postScrollRef = useRef<TermElement | null>(null);
  const postContentRef = useRef<TermElement | null>(null);
  const shortcutsScrollRef = useRef<TermElement | null>(null);
  const replyInputRef = useRef<TermInput | null>(null);
  const focusedReplyRefs = useRef<Array<TermElement | null>>([]);
  const bundleRef = useRef<ReadPostBundle | null>(null);
  const selectedPostIdRef = useRef<string | null>(null);
  const selectedIndexRef = useRef(0);
  const channelFilterRef = useRef(initialChannelFilter);
  const sortModeRef = useRef<BrowseSortMode>("activity");
  const noticeRef = useRef<ReturnType<typeof createInitialBrowseState>["notice"]>(null);
  const viewRef = useRef<ReturnType<typeof createInitialBrowseState>["view"]>("list");
  const replyBodyRef = useRef("");
  const initialOpenAttemptedRef = useRef(false);

  const [state, dispatch] = useReducer(
    browseReducer,
    createInitialBrowseState({ initialChannelFilter, initialAutoRefresh })
  );

  const theme = THEMES[state.themeIndex];
  const channels = useMemo(() => listChannels(state.rawPosts), [state.rawPosts]);
  const channelStats = useMemo(() => buildChannelStats(state.rawPosts), [state.rawPosts]);
  const filters = useMemo(
    () =>
      buildBrowseFilters({
        channel: state.channelFilter === "__all__" ? undefined : state.channelFilter,
        type: baseFilters.type,
        severity: baseFilters.severity,
        status: baseFilters.status,
        tag: baseFilters.tag,
        pinned: baseFilters.pinned,
        unreadForSession: baseFilters.unreadForSession,
        subscribedForActor: baseFilters.subscribedForActor,
        assignedTo: baseFilters.assignedTo,
        waitingForActor: baseFilters.waitingForActor,
        limit
      }),
    [baseFilters, limit, state.channelFilter]
  );
  const posts = useMemo(
    () => filterAndSortPosts(state.rawPosts, { channelFilter: state.channelFilter, sortMode: state.sortMode, limit }),
    [limit, state.channelFilter, state.rawPosts, state.sortMode]
  );
  const selectedPost = posts[state.selectedIndex] ?? null;
  const conversationItems = useMemo(
    () => state.bundle ? buildConversationItems(state.bundle, { filterMode: state.conversationFilterMode, sortMode: state.conversationSortMode }) : [],
    [state.bundle, state.conversationFilterMode, state.conversationSortMode]
  );
  const selectedConversationIndex = useMemo(
    () => resolveConversationSelection(conversationItems, state.focusedReplyIndex),
    [conversationItems, state.focusedReplyIndex]
  );
  const now = useMemo(() => new Date(), [state.lastRefreshAt]);

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

  const refreshData = useCallback(
    (reason: "initial" | "manual" | "auto" | "reply", focusedId?: string) => {
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
          currentIndex: selectedIndexRef.current,
          currentBundle: bundleRef.current,
          focusedId: focusedId ?? selectedPostIdRef.current ?? undefined
        });

        dispatch({
          type: "patch",
          patch: {
            rawPosts: result.rawPosts,
            selectedIndex: result.selectedIndex,
            bundle: result.bundle,
            lastRefreshAt: formatRefreshClock(),
            loading: false,
            refreshing: false,
            notice: reason === "manual"
              ? { kind: "info", text: "Feed refreshed." }
              : reason === "reply" && focusedId
                ? { kind: "info", text: `Reply posted to ${focusedId}.` }
                : noticeRef.current
          }
        });
      } catch (error) {
        dispatch({
          type: "patch",
          patch: {
            bundle: bundleRef.current ? null : null,
            view: bundleRef.current ? "list" : viewRef.current,
            replyBody: bundleRef.current ? "" : replyBodyRef.current,
            notice: {
              kind: "error",
              text: bundleRef.current ? `Open post is no longer available. ${toMessage(error)}` : toMessage(error)
            },
            loading: false,
            refreshing: false
          }
        });
      }
    },
    [baseFilters, limit, postService]
  );

  const openPost = useCallback(
    (postId: string) => {
      try {
        const nextBundle = postService.getPost(postId);
        dispatch({ type: "openBundle", bundle: nextBundle });
      } catch (error) {
        dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
      }
    },
    [postService]
  );

  const toggleAutoRefresh = useCallback(() => {
    const next = !state.autoRefreshEnabled;
    dispatch({
      type: "patch",
      patch: {
        autoRefreshEnabled: next,
        notice: {
          kind: "info",
          text: next ? `Auto refresh enabled (${refreshMs % 1000 === 0 ? `${refreshMs / 1000}s` : `${refreshMs}ms`}).` : "Auto refresh paused."
        }
      }
    });
  }, [refreshMs, state.autoRefreshEnabled]);

  const submitReply = useCallback(() => {
    if (!state.bundle) {
      return;
    }

    try {
      submitBrowseReply(replyService, {
        postId: state.bundle.post.id,
        body: state.replyBody,
        actor
      });
      dispatch({ type: "patch", patch: { replyBody: "", view: "post" } });
      refreshData("reply", state.bundle.post.id);
    } catch (error) {
      dispatch({ type: "setNotice", notice: { kind: "error", text: toMessage(error) } });
    }
  }, [actor, refreshData, replyService, state.bundle, state.replyBody]);

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
    if (!initialPostId || state.loading || initialOpenAttemptedRef.current) {
      return;
    }

    initialOpenAttemptedRef.current = true;
    openPost(initialPostId);
  }, [initialPostId, openPost, state.loading]);

  useEffect(() => {
    if (state.view === "reply") {
      replyInputRef.current?.focus();
      return;
    }

    rootRef.current?.focus();
  }, [state.view]);

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
  }, [refreshReadProgress, state.bundle?.post.id, state.view]);

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
      dispatch({ type: "patch", patch: { focusedReplyIndex: -1 } });
      return;
    }

    const currentExists = conversationItems.some((item) => item.replyIndex === state.focusedReplyIndex);
    if (!currentExists) {
      dispatch({ type: "patch", patch: { focusedReplyIndex: conversationItems[0].replyIndex } });
    }
  }, [conversationItems, state.focusedReplyIndex, state.view]);

  useEffect(() => {
    if (!state.autoRefreshEnabled || state.view === "reply") {
      return;
    }

    const interval = setInterval(() => {
      refreshData("auto");
    }, refreshMs);

    return () => clearInterval(interval);
  }, [refreshData, refreshMs, state.autoRefreshEnabled, state.view]);

  const handleKeyPress = useCallback((event: { attributes: { key: KeyLike } }) => {
    const command = resolveBrowseKeyCommand(
      {
        view: state.view,
        showShortcutsHelp: state.showShortcutsHelp,
        confirmDelete: Boolean(state.confirmDelete),
        replyBody: state.replyBody,
        postPanelFocus: state.postPanelFocus,
        conversationFilterMode: state.conversationFilterMode,
        focusedReplyIndex: state.focusedReplyIndex,
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
        dispatch({ type: "patch", patch: { confirmDelete: null, notice: null } });
        return;
      case "replyCancel":
        dispatch({ type: "patch", patch: { view: "post", notice: null } });
        return;
      case "copyReplyDraft":
        copyToClipboard(state.replyBody);
        dispatch({ type: "setNotice", notice: { kind: "info", text: "Copied reply draft to clipboard." } });
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
        dispatch({ type: "patch", patch: { themeIndex: next, notice: { kind: "info", text: `Theme: ${THEMES[next].name}` } } });
        return;
      }
      case "toggleAutoRefresh":
        toggleAutoRefresh();
        return;
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
            selectedIndex: 0,
            view: "list",
            notice: null
          }
        });
        return;
      case "channelsBack":
        dispatch({ type: "patch", patch: { view: "list", notice: null } });
        return;
      case "cycleChannelFilter": {
        const next = nextChannelFilter(channels, state.channelFilter);
        dispatch({
          type: "patch",
          patch: {
            channelFilter: next,
            selectedIndex: 0,
            notice: { kind: "info", text: next === "__all__" ? "Showing all channels." : `Channel filter: #${next}.` }
          }
        });
        return;
      }
      case "cycleSortMode": {
        const next = nextValue(SORT_MODES, state.sortMode);
        dispatch({ type: "patch", patch: { sortMode: next, notice: { kind: "info", text: `Sort: ${next}.` } } });
        return;
      }
      case "listMove":
        dispatch({ type: "patch", patch: { selectedIndex: clampIndex(state.selectedIndex + command.delta, posts.length) } });
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
        dispatch({ type: "patch", patch: { view: "channels", notice: null } });
        return;
      case "postFocus":
        dispatch({ type: "patch", patch: { postPanelFocus: command.focus } });
        return;
      case "postMoveConversation": {
        const nextIndex = clampIndex(selectedConversationIndex + command.delta, conversationItems.length);
        const nextItem = conversationItems[nextIndex];
        if (nextItem) {
          dispatch({ type: "patch", patch: { focusedReplyIndex: nextItem.replyIndex } });
        }
        return;
      }
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
          dispatch({ type: "setNotice", notice: { kind: "info", text: `Copied ${label} to clipboard.` } });
        }
        return;
      }
      case "openReferencedPost":
        if (state.bundle?.post.refId) {
          openPost(state.bundle.post.refId);
        }
        return;
      case "cycleConversationFilter": {
        const next = nextValue(CONVERSATION_FILTER_MODES, state.conversationFilterMode);
        dispatch({ type: "patch", patch: { conversationFilterMode: next, notice: { kind: "info", text: `Conversation filter: ${next}.` } } });
        return;
      }
      case "cycleConversationSort": {
        const next = nextValue(CONVERSATION_SORT_MODES, state.conversationSortMode);
        dispatch({ type: "patch", patch: { conversationSortMode: next, notice: { kind: "info", text: `Conversation sort: ${next}.` } } });
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
          dispatch({ type: "patch", patch: { focusedReplyIndex: -1, notice: null } });
        } else {
          dispatch({ type: "patch", patch: { view: "list", notice: null } });
        }
        return;
      case "startReply":
        dispatch({ type: "startReply" });
        return;
      case "noop":
        return;
    }
  }, [
    channelStats,
    channels,
    conversationItems,
    executeDelete,
    openPost,
    posts.length,
    refreshData,
    refreshReadProgress,
    screen,
    selectedConversationIndex,
    selectedPost,
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
    loading: state.loading,
    refreshing: state.refreshing,
    channelStats,
    rawPosts: state.rawPosts,
    channelSelectedIndex: state.channelSelectedIndex,
    channelItemRefs,
    selectedIndex: state.selectedIndex,
    listItemRefs,
    now,
    actor,
    conversationItems,
    conversationFilterMode: state.conversationFilterMode,
    conversationSortMode: state.conversationSortMode,
    focusedReplyRefs,
    postScrollRef,
    postContentRef,
    postPanelFocus: state.postPanelFocus,
    readProgressLabel: state.readProgressLabel,
    replyBody: state.replyBody,
    replyInputRef,
    onReplyBodyChange: (value: string) => dispatch({ type: "setReplyBody", value }),
    notice: state.notice,
    selectedConversationIndex,
    showShortcutsHelp: state.showShortcutsHelp,
    shortcutsScrollRef
  };
}

function scrollBy(element: TermElement | null, delta: number): void {
  if (!element) {
    return;
  }

  element.scrollTop = Math.max(0, element.scrollTop + delta);
}
