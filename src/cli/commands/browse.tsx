import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Command } from "commander";
import type { TermElement, TermInput } from "terminosaurus";
import { render, useScreen } from "terminosaurus/react";

import { PostService } from "../../domain/post.service.js";
import { ReplyService } from "../../domain/reply.service.js";
import { createDomainDependencies } from "../../domain/factory.js";
import { AgentForumError, type PostFilters, type PostStatus, type PostType, type ReadPostBundle, type Severity } from "../../domain/types.js";
import { handleError, readConfig, resolveActor } from "../helpers.js";
import {
  ALL_CHANNELS,
  type BrowseListPost,
  type BrowseSortMode,
  type ConversationFilterMode,
  type ConversationItem,
  type ConversationSortMode,
  type BrowseTheme,
  type ChannelStats,
  CONVERSATION_FILTER_MODES,
  CONVERSATION_SORT_MODES,
  DEFAULT_REFRESH_MS,
  SORT_MODES,
  THEMES,
  buildConversationItems,
  buildBaseBrowseFilters,
  buildBrowseFilters,
  buildBrowseHint,
  buildChannelStats,
  buildFilterSummary,
  buildReadProgressLabel,
  copyToClipboard,
  describeConversationFilterMode,
  describeConversationSortMode,
  describeRefreshMs,
  describeSortMode,
  excerpt,
  filterAndSortPosts,
  getLastActivityAt,
  getPostTypeTone,
  getStatusTone,
  listChannels,
  nextChannelFilter,
  nextValue,
  parseLimit,
  parseRefreshMs,
  resolveConversationSelection,
  resolveSelectedIndex,
  sanitizeTerminalText,
  severityColor,
  statusIcon,
  timeAgo,
  typeIcon
} from "./browse.lib.js";

interface BrowseOptions {
  id?: string;
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  pinned?: boolean;
  limit?: string;
  actor?: string;
  unreadFor?: string;
  subscribedFor?: string;
  assignedTo?: string;
  waitingFor?: string;
  autoRefresh?: boolean;
  refreshMs?: string;
}

type ViewMode = "list" | "post" | "reply" | "channels";
type Notice = { kind: "info" | "error"; text: string } | null;
type RefreshReason = "initial" | "manual" | "auto" | "reply";
type KeyLike = {
  name: string;
  sequence: string;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  shift: boolean;
};

interface BrowseAppProps {
  postService: PostService;
  replyService: ReplyService;
  baseFilters: PostFilters;
  initialChannelFilter: string;
  limit: number;
  actor?: string;
  refreshMs: number;
  initialAutoRefresh: boolean;
  initialPostId?: string;
}

export function registerBrowseCommand(program: Command): void {
  program
    .command("browse")
    .description("Interactive terminal browser for humans")
    .option("--id <id>", "Open a specific thread immediately")
    .option("--channel <channel>", "Filter by channel")
    .option("--type <type>", "Filter by type")
    .option("--severity <severity>", "Filter by severity")
    .option("--status <status>", "Filter by status")
    .option("--tag <tag>", "Filter by tag")
    .option("--pinned", "Show only pinned posts")
    .option("--limit <number>", "Limit number of posts", "30")
    .option("--actor <actor>", "Actor identity used when replying")
    .option("--unread-for <session>", "Show only unread posts for a session")
    .option("--subscribed-for <actor>", "Show only posts matching subscriptions for an actor")
    .option("--assigned-to <actor>", "Show only posts assigned to an actor")
    .option("--waiting-for <actor>", "Show creator-owned threads waiting on review/acceptance")
    .option("--auto-refresh", "Refresh posts automatically while browsing")
    .option("--refresh-ms <number>", "Auto refresh interval in milliseconds", `${DEFAULT_REFRESH_MS}`)
    .action(async (options: BrowseOptions) => {
      try {
        await launchBrowse(options);
      } catch (error) {
        handleError(error);
      }
    });
}

export async function launchBrowse(options: BrowseOptions): Promise<void> {
  const config = readConfig();
  const dependencies = createDomainDependencies(config);
  const postService = new PostService(config, dependencies);
  const replyService = new ReplyService(config, dependencies);
  const limit = parseLimit(options.limit);
  const refreshMs = parseRefreshMs(options.refreshMs);

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new AgentForumError("`af browse` requires an interactive terminal.", 3);
  }

  await render(
    {},
    <BrowseApp
      postService={postService}
      replyService={replyService}
      baseFilters={buildBaseBrowseFilters({
        channel: options.channel,
        type: options.type,
        severity: options.severity,
        status: options.status,
        tag: options.tag,
        pinned: options.pinned ? true : undefined,
        unreadForSession: options.unreadFor,
        subscribedForActor: options.subscribedFor,
        assignedTo: options.assignedTo,
        waitingForActor: options.waitingFor
      })}
      initialChannelFilter={options.channel ?? ALL_CHANNELS}
      limit={limit}
      actor={resolveActor(config, options.actor)}
      refreshMs={refreshMs}
      initialAutoRefresh={options.autoRefresh ?? false}
      initialPostId={options.id}
    />
  );
}

function BrowseApp({ postService, replyService, baseFilters, initialChannelFilter, limit, actor, refreshMs, initialAutoRefresh, initialPostId }: BrowseAppProps) {
  const screen = useScreen();
  const rootRef = useRef<TermElement | null>(null);
  const listItemRefs = useRef<Array<TermElement | null>>([]);
  const channelItemRefs = useRef<Array<TermElement | null>>([]);
  const postScrollRef = useRef<TermElement | null>(null);
  const postContentRef = useRef<TermElement | null>(null);
  const shortcutsScrollRef = useRef<TermElement | null>(null);
  const replyInputRef = useRef<TermInput | null>(null);
  const bundleRef = useRef<ReadPostBundle | null>(null);
  const selectedPostIdRef = useRef<string | null>(null);
  const channelFilterRef = useRef(initialChannelFilter);
  const sortModeRef = useRef<BrowseSortMode>("activity");
  const initialOpenAttemptedRef = useRef(false);

  const [view, setView] = useState<ViewMode>("list");
  const [rawPosts, setRawPosts] = useState<BrowseListPost[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [channelSelectedIndex, setChannelSelectedIndex] = useState(0);
  const [bundle, setBundle] = useState<ReadPostBundle | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(initialAutoRefresh);
  const [lastRefreshAt, setLastRefreshAt] = useState("not yet");
  const [channelFilter, setChannelFilter] = useState(initialChannelFilter);
  const [sortMode, setSortMode] = useState<BrowseSortMode>("activity");
  const [themeIndex, setThemeIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<BrowseListPost | null>(null);
  const [focusedReplyIndex, setFocusedReplyIndex] = useState(-1);
  const [postPanelFocus, setPostPanelFocus] = useState<"index" | "content">("index");
  const [conversationFilterMode, setConversationFilterMode] = useState<ConversationFilterMode>("all");
  const [conversationSortMode, setConversationSortMode] = useState<ConversationSortMode>("thread");
  const [readProgressLabel, setReadProgressLabel] = useState("[100% read]");
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const focusedReplyRefs = useRef<Array<TermElement | null>>([]);

  const theme = THEMES[themeIndex];

  const channels = useMemo(() => listChannels(rawPosts), [rawPosts]);
  const channelStats = useMemo(() => buildChannelStats(rawPosts), [rawPosts]);
  const filters = useMemo(
    () =>
      buildBrowseFilters({
        channel: channelFilter === ALL_CHANNELS ? undefined : channelFilter,
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
    [
      baseFilters.assignedTo,
      baseFilters.pinned,
      baseFilters.severity,
      baseFilters.status,
      baseFilters.subscribedForActor,
      baseFilters.tag,
      baseFilters.type,
      baseFilters.unreadForSession,
      baseFilters.waitingForActor,
      channelFilter,
      limit
    ]
  );
  const posts = useMemo(() => filterAndSortPosts(rawPosts, { channelFilter, sortMode, limit }), [channelFilter, limit, rawPosts, sortMode]);
  const selectedPost = posts[selectedIndex] ?? null;
  selectedPostIdRef.current = selectedPost?.id ?? null;
  const filterSummary = useMemo(() => {
    return buildFilterSummary(filters, posts.length, { autoRefreshEnabled, refreshMs, lastRefreshAt, sortMode });
  }, [autoRefreshEnabled, filters, lastRefreshAt, posts.length, refreshMs, sortMode]);
  const conversationItems = useMemo(
    () => bundle ? buildConversationItems(bundle, { filterMode: conversationFilterMode, sortMode: conversationSortMode }) : [],
    [bundle, conversationFilterMode, conversationSortMode]
  );
  const selectedConversationIndex = useMemo(
    () => resolveConversationSelection(conversationItems, focusedReplyIndex),
    [conversationItems, focusedReplyIndex]
  );

  useEffect(() => {
    bundleRef.current = bundle;
  }, [bundle]);

  useEffect(() => {
    channelFilterRef.current = channelFilter;
  }, [channelFilter]);

  useEffect(() => {
    sortModeRef.current = sortMode;
  }, [sortMode]);

  const refreshReadProgress = useCallback(() => {
    const element = postContentRef.current;
    if (!element) {
      setReadProgressLabel("[100% read]");
      return;
    }

    setReadProgressLabel(buildReadProgressLabel(element.scrollTop, element.scrollHeight, element.offsetHeight));
  }, []);

  const refreshData = useCallback(
    (reason: RefreshReason, focusedId?: string) => {
      if (reason === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const nextPosts = postService.listPosts({ ...baseFilters, limit: undefined });
        const currentBundle = bundleRef.current;
        const nextBrowsePosts = nextPosts.map((post) => {
          const postBundle = postService.getPost(post.id);
          const lastReply = postBundle.replies.length > 0 ? postBundle.replies[postBundle.replies.length - 1] : null;
          return {
            ...post,
            lastActivityAt: getLastActivityAt(post, postBundle),
            replyCount: postBundle.replies.length,
            reactionCount: postBundle.reactions.length,
            lastReplyExcerpt: lastReply ? excerpt(lastReply.body) : null,
            lastReplyActor: lastReply?.actor ?? null
          };
        });

        const currentFilter = channelFilterRef.current;
        const currentSort = sortModeRef.current;
        const nextVisiblePosts = filterAndSortPosts(nextBrowsePosts, {
          channelFilter: currentFilter,
          sortMode: currentSort,
          limit
        });

        setRawPosts(nextBrowsePosts);
        setSelectedIndex((current) => {
          const resolvedFocusId = focusedId ?? currentBundle?.post.id ?? selectedPostIdRef.current ?? undefined;
          return resolveSelectedIndex(nextVisiblePosts, current, resolvedFocusId);
        });

        if (currentBundle) {
          try {
            setBundle(postService.getPost(currentBundle.post.id));
          } catch (error) {
            setBundle(null);
            setView("list");
            setReplyBody("");
            setNotice({ kind: "error", text: `Open post is no longer available. ${toMessage(error)}` });
          }
        }

        setLastRefreshAt(formatRefreshClock());

        if (reason === "manual") {
          setNotice({ kind: "info", text: "Feed refreshed." });
        } else if (reason === "reply" && focusedId) {
          setNotice({ kind: "info", text: `Reply posted to ${focusedId}.` });
        }
      } catch (error) {
        setNotice({ kind: "error", text: toMessage(error) });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [baseFilters, limit, postService]
  );

  const openPost = useCallback(
    (postId: string) => {
      try {
        const nextBundle = postService.getPost(postId);
        setBundle(nextBundle);
        setReplyBody("");
        setFocusedReplyIndex(-1);
        setPostPanelFocus("index");
        setConversationFilterMode("all");
        setConversationSortMode("thread");
        setReadProgressLabel("[100% read]");
        setView("post");
        setNotice(null);
      } catch (error) {
        setNotice({ kind: "error", text: toMessage(error) });
      }
    },
    [postService]
  );

  const toggleAutoRefresh = useCallback(() => {
    setAutoRefreshEnabled((current) => {
      const next = !current;
      setNotice({
        kind: "info",
        text: next ? `Auto refresh enabled (${describeRefreshMs(refreshMs)}).` : "Auto refresh paused."
      });
      return next;
    });
  }, [refreshMs]);

  const submitReply = useCallback(() => {
    if (!bundle) {
      return;
    }

    try {
      replyService.createReply({
        postId: bundle.post.id,
        body: replyBody,
        actor
      });

      setReplyBody("");
      setView("post");
      refreshData("reply", bundle.post.id);
    } catch (error) {
      setNotice({ kind: "error", text: toMessage(error) });
    }
  }, [actor, bundle, refreshData, replyBody, replyService]);

  const executeDelete = useCallback(() => {
    if (!confirmDelete) {
      return;
    }

    try {
      postService.deletePost(confirmDelete.id);
      setConfirmDelete(null);

      if (bundle?.post.id === confirmDelete.id) {
        setBundle(null);
        setView("list");
      }

      refreshData("manual");
      setNotice({ kind: "info", text: `Deleted: ${confirmDelete.title} (${confirmDelete.id})` });
    } catch (error) {
      setConfirmDelete(null);
      setNotice({ kind: "error", text: toMessage(error) });
    }
  }, [bundle?.post.id, confirmDelete, postService, refreshData]);

  useEffect(() => {
    refreshData("initial");
  }, [refreshData]);

  useEffect(() => {
    if (!initialPostId || loading || initialOpenAttemptedRef.current) {
      return;
    }

    initialOpenAttemptedRef.current = true;
    openPost(initialPostId);
  }, [initialPostId, loading, openPost]);

  useEffect(() => {
    if (view === "reply") {
      replyInputRef.current?.focus();
      return;
    }

    rootRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view === "list") {
      listItemRefs.current[selectedIndex]?.scrollIntoView({ alignY: "auto", forceY: true });
    }
  }, [selectedIndex, posts.length, view]);

  useEffect(() => {
    if (view === "channels") {
      channelItemRefs.current[channelSelectedIndex]?.scrollIntoView({ alignY: "auto", forceY: true });
    }
  }, [channelSelectedIndex, channelStats.length, view]);

  useEffect(() => {
    if (view === "post") {
      if (postScrollRef.current) {
        postScrollRef.current.scrollTop = 0;
      }
      if (postContentRef.current) {
        postContentRef.current.scrollTop = 0;
      }
      refreshReadProgress();
    }
  }, [bundle?.post.id, refreshReadProgress, view]);

  useEffect(() => {
    if (view === "post" && selectedConversationIndex >= 0) {
      focusedReplyRefs.current[selectedConversationIndex]?.scrollIntoView({ alignY: "auto", forceY: true });
      if (postContentRef.current) {
        postContentRef.current.scrollTop = 0;
      }
      refreshReadProgress();
    }
  }, [refreshReadProgress, selectedConversationIndex, view]);

  useEffect(() => {
    if (view !== "post") {
      return;
    }

    if (conversationItems.length === 0) {
      setFocusedReplyIndex(-1);
      return;
    }

    const currentExists = conversationItems.some((item) => item.replyIndex === focusedReplyIndex);
    if (!currentExists) {
      setFocusedReplyIndex(conversationItems[0].replyIndex);
    }
  }, [conversationItems, focusedReplyIndex, view]);

  useEffect(() => {
    if (!autoRefreshEnabled || view === "reply") {
      return;
    }

    const interval = setInterval(() => {
      refreshData("auto");
    }, refreshMs);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, refreshData, refreshMs, view]);

  const clampIndex = useCallback(
    (index: number, length: number) => {
      if (length === 0) return 0;
      return Math.max(0, Math.min(length - 1, index));
    },
    []
  );

  const handleKeyPress = useCallback(
    (event: { attributes: { key: KeyLike } }) => {
      const { key } = event.attributes;

      if (isCtrlKey(key, "c")) {
        screen.terminate(0);
        return;
      }

      if (showShortcutsHelp) {
        if (isEscapeKey(key) || isCharacterKey(key, "?")) {
          setShowShortcutsHelp(false);
          return;
        }

        if (isUpKey(key)) {
          scrollBy(shortcutsScrollRef.current, -3);
          return;
        }

        if (isDownKey(key)) {
          scrollBy(shortcutsScrollRef.current, 3);
          return;
        }

        if (isPgUpKey(key)) {
          scrollBy(shortcutsScrollRef.current, -10);
          return;
        }

        if (isPgDownKey(key)) {
          scrollBy(shortcutsScrollRef.current, 10);
        }
        return;
      }

      if (confirmDelete) {
        if (isCharacterKey(key, "y")) {
          executeDelete();
          return;
        }

        setConfirmDelete(null);
        setNotice(null);
        return;
      }

      if (view === "reply") {
        if (isEscapeKey(key)) {
          setView("post");
          setNotice(null);
          return;
        }

        if (isCtrlKey(key, "y")) {
          if (replyBody.trim()) {
            copyToClipboard(replyBody);
            setNotice({ kind: "info", text: "Copied reply draft to clipboard." });
          }
          return;
        }

        if ((key.ctrl && isEnterKey(key)) || isCtrlKey(key, "s")) {
          submitReply();
        }

        return;
      }

      if (isCharacterKey(key, "q")) {
        screen.terminate(0);
        return;
      }

      if (isCharacterKey(key, "?")) {
        setShowShortcutsHelp(true);
        return;
      }

      if (isCharacterKey(key, "t")) {
        setThemeIndex((current) => {
          const next = (current + 1) % THEMES.length;
          setNotice({ kind: "info", text: `Theme: ${THEMES[next].name}` });
          return next;
        });
        return;
      }

      if (isCharacterKey(key, "a")) {
        toggleAutoRefresh();
        return;
      }

      if (isCharacterKey(key, "u")) {
        refreshData("manual");
        return;
      }

      if (view === "channels") {
        const totalChannels = channelStats.length + 1;

        if (isUpKey(key)) {
          setChannelSelectedIndex((current) => clampIndex(current - 1, totalChannels));
          return;
        }

        if (isDownKey(key)) {
          setChannelSelectedIndex((current) => clampIndex(current + 1, totalChannels));
          return;
        }

        if (isEnterKey(key)) {
          if (channelSelectedIndex === 0) {
            setChannelFilter(ALL_CHANNELS);
          } else {
            setChannelFilter(channelStats[channelSelectedIndex - 1].name);
          }
          setSelectedIndex(0);
          setView("list");
          setNotice(null);
          return;
        }

        if (isTabKey(key)) {
          setView("list");
          setNotice(null);
          return;
        }

        return;
      }

      if (isCharacterKey(key, "c")) {
        setChannelFilter((current) => {
          const next = nextChannelFilter(channels, current);
          setNotice({
            kind: "info",
            text: next === ALL_CHANNELS ? "Showing all channels." : `Channel filter: #${next}.`
          });
          return next;
        });
        setSelectedIndex(0);
        return;
      }

      if (isCharacterKey(key, "o")) {
        setSortMode((current) => {
          const next = nextValue(SORT_MODES, current);
          setNotice({ kind: "info", text: `Sort: ${describeSortMode(next)}.` });
          return next;
        });
        return;
      }

      if (view === "list") {
        if (isUpKey(key)) {
          setSelectedIndex((current) => clampIndex(current - 1, posts.length));
          return;
        }

        if (isDownKey(key)) {
          setSelectedIndex((current) => clampIndex(current + 1, posts.length));
          return;
        }

        if (isEnterKey(key) && selectedPost) {
          openPost(selectedPost.id);
          return;
        }

        if (isCharacterKey(key, "d") && selectedPost) {
          setConfirmDelete(selectedPost);
          setNotice({ kind: "error", text: `Delete "${selectedPost.title}"? y confirm  |  any key cancel` });
          return;
        }

        if (isTabKey(key)) {
          setView("channels");
          setNotice(null);
          return;
        }

        return;
      }

      if (view === "post") {
        if (isLeftKey(key)) {
          setPostPanelFocus("index");
          return;
        }

        if (isRightKey(key)) {
          setPostPanelFocus("content");
          return;
        }

        if (isUpKey(key)) {
          if (postPanelFocus === "index") {
            const nextIndex = Math.max(0, selectedConversationIndex - 1);
            const nextItem = conversationItems[nextIndex];
            if (nextItem) {
              setFocusedReplyIndex(nextItem.replyIndex);
            }
          } else {
            scrollBy(postContentRef.current, -3);
            refreshReadProgress();
          }
          return;
        }

        if (isDownKey(key)) {
          if (postPanelFocus === "index") {
            const nextIndex = Math.min(conversationItems.length - 1, selectedConversationIndex + 1);
            const nextItem = conversationItems[nextIndex];
            if (nextItem) {
              setFocusedReplyIndex(nextItem.replyIndex);
            }
          } else {
            scrollBy(postContentRef.current, 3);
            refreshReadProgress();
          }
          return;
        }

        if (isPgUpKey(key)) {
          const nextIndex = Math.max(0, selectedConversationIndex - 1);
          const nextItem = conversationItems[nextIndex];
          if (nextItem) {
            setFocusedReplyIndex(nextItem.replyIndex);
          }
          return;
        }

        if (isPgDownKey(key)) {
          const nextIndex = Math.min(conversationItems.length - 1, selectedConversationIndex + 1);
          const nextItem = conversationItems[nextIndex];
          if (nextItem) {
            setFocusedReplyIndex(nextItem.replyIndex);
          }
          return;
        }

        if (isCharacterKey(key, "y") && bundle) {
          const text = focusedReplyIndex === -1
            ? bundle.post.body
            : bundle.replies[focusedReplyIndex]?.body ?? "";
          if (text) {
            copyToClipboard(text);
            const label = focusedReplyIndex === -1 ? "post body" : `reply ${focusedReplyIndex + 1}`;
            setNotice({ kind: "info", text: `Copied ${label} to clipboard.` });
          }
          return;
        }

        if (isCharacterKey(key, "g") && bundle?.post.refId) {
          openPost(bundle.post.refId);
          return;
        }

        if (isCharacterKey(key, "f")) {
          setConversationFilterMode((current) => {
            const next = nextValue(CONVERSATION_FILTER_MODES, current);
            setNotice({ kind: "info", text: `Conversation filter: ${describeConversationFilterMode(next)}.` });
            return next;
          });
          return;
        }

        if (isCharacterKey(key, "s")) {
          setConversationSortMode((current) => {
            const next = nextValue(CONVERSATION_SORT_MODES, current);
            setNotice({ kind: "info", text: `Conversation sort: ${describeConversationSortMode(next)}.` });
            return next;
          });
          return;
        }

        if (isCharacterKey(key, "d") && bundle) {
          const target: BrowseListPost = { ...bundle.post, lastActivityAt: bundle.post.createdAt, replyCount: bundle.replies.length, reactionCount: bundle.reactions.length, lastReplyExcerpt: null, lastReplyActor: null };
          setConfirmDelete(target);
          setNotice({ kind: "error", text: `Delete "${bundle.post.title}"? y confirm  |  any key cancel` });
          return;
        }

        if (isCharacterKey(key, "b") || isEscapeKey(key)) {
          if (focusedReplyIndex >= 0 && conversationFilterMode === "all") {
            setFocusedReplyIndex(-1);
          } else {
            setView("list");
          }
          setNotice(null);
          return;
        }

        if (isCharacterKey(key, "r")) {
          setReplyBody("");
          setView("reply");
        }
      }
    },
    [bundle, channels, channelSelectedIndex, channelStats, clampIndex, confirmDelete, conversationFilterMode, conversationItems, executeDelete, focusedReplyIndex, openPost, postPanelFocus, posts.length, refreshData, refreshReadProgress, replyBody, screen, selectedConversationIndex, selectedPost, showShortcutsHelp, submitReply, toggleAutoRefresh, view]
  );

  const now = useMemo(() => new Date(), [lastRefreshAt]);

  return (
    <term:div
      ref={rootRef}
      width="100%"
      height="100%"
      padding={[1, 2]}
      flexDirection="column"
      backgroundColor={theme.bg}
      color={theme.fg}
      focusEvents
      onKeyPress={handleKeyPress}
    >
      <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginBottom={1} flexDirection="row" alignItems="center">
        <term:text color={theme.accent} fontWeight="bold">
          {breadcrumb(view, channelFilter, bundle, focusedReplyIndex)}
        </term:text>
        <term:text color={theme.muted} marginLeft={2}>
          {`${describeSortMode(sortMode)}  |  ${autoRefreshEnabled ? `auto ${describeRefreshMs(refreshMs)}` : "auto off"}  |  ${posts.length} threads  |  ${theme.name}`}
        </term:text>
        {refreshing ? (
          <term:text color={theme.warning} marginLeft={1} fontWeight="bold">
            {"  \u21BB"}
          </term:text>
        ) : null}
      </term:div>

      {view === "post" && bundle ? (
        <PostContextBar bundle={bundle} focusedReplyIndex={focusedReplyIndex} actor={actor} now={now} theme={theme} />
      ) : null}

      <term:div
        ref={undefined}
        flexGrow={1}
        flexShrink={1}
        overflow={view === "post" ? undefined : "scroll"}
        padding={[0, 0]}
      >
        {loading ? (
          <term:text color={theme.warning}>{"  Loading threads..."}</term:text>
        ) : view === "channels" ? (
          <ChannelsView
            channelStats={channelStats}
            totalThreads={rawPosts.length}
            selectedIndex={channelSelectedIndex}
            itemRefs={channelItemRefs}
            now={now}
            theme={theme}
          />
        ) : view === "list" ? (
          <ListView posts={posts} selectedIndex={selectedIndex} listItemRefs={listItemRefs} now={now} theme={theme} />
        ) : view === "post" ? (
          <PostView
            bundle={bundle}
            actor={actor}
            now={now}
            theme={theme}
            focusedIndex={focusedReplyIndex}
            conversationItems={conversationItems}
            conversationFilterMode={conversationFilterMode}
            conversationSortMode={conversationSortMode}
            itemRefs={focusedReplyRefs}
            indexScrollRef={postScrollRef}
            contentScrollRef={postContentRef}
            panelFocus={postPanelFocus}
            readProgressLabel={readProgressLabel}
          />
        ) : (
          <ReplyView
            bundle={bundle}
            replyBody={replyBody}
            actor={actor}
            inputRef={replyInputRef}
            onReplyBodyChange={setReplyBody}
            theme={theme}
          />
        )}
      </term:div>

      <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginTop={1} flexDirection="row">
        <term:text color={noticeColor(notice) ?? theme.fg}>
          {sanitizeTerminalText(notice?.text ?? buildBrowseHint(view, posts.length, { autoRefreshEnabled, refreshMs }))}
        </term:text>
        <term:text color={theme.muted} flexGrow={1} textAlign="right">
          {view === "list" && posts.length > 0
            ? `${selectedIndex + 1}/${posts.length}  |  `
            : view === "post" && bundle
              ? `${selectedConversationIndex + 1}/${Math.max(conversationItems.length, 1)}  |  `
              : ""}
          {" ? shortcuts  |  t theme  |  a auto  |  Ctrl+C exit"}
        </term:text>
      </term:div>

      {showShortcutsHelp ? <ShortcutsModal view={view} theme={theme} scrollRef={shortcutsScrollRef} /> : null}
    </term:div>
  );
}

function ChannelsView({
  channelStats,
  totalThreads,
  selectedIndex,
  itemRefs,
  now,
  theme
}: {
  channelStats: ChannelStats[];
  totalThreads: number;
  selectedIndex: number;
  itemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  theme: BrowseTheme;
}) {
  const allSelected = selectedIndex === 0;

  return (
    <term:div flexDirection="column" padding={[0, 1]}>
      <term:div
        ref={(el: TermElement | null) => {
          itemRefs.current[0] = el;
        }}
        border={allSelected ? "modern" : "rounded"}
        borderColor={allSelected ? theme.accent : theme.muted}
        padding={[0, 1]}
        marginBottom={1}
        backgroundColor={allSelected ? theme.selected : undefined}
        color={allSelected ? theme.selectedFg : undefined}
        flexDirection="row"
      >
        <term:text fontWeight="bold">
          {`${allSelected ? "\u25B8" : " "} # all`}
        </term:text>
        <term:text flexGrow={1} textAlign="right">{`${totalThreads} threads`}</term:text>
      </term:div>

      {channelStats.map((ch, index) => {
        const selected = index + 1 === selectedIndex;
        return (
          <term:div
            key={ch.name}
            ref={(el: TermElement | null) => {
              itemRefs.current[index + 1] = el;
            }}
            border={selected ? "modern" : "rounded"}
            borderColor={selected ? theme.accent : theme.muted}
            padding={[0, 1]}
            marginBottom={1}
            backgroundColor={selected ? theme.selected : undefined}
            color={selected ? theme.selectedFg : undefined}
            flexDirection="row"
          >
            <term:text fontWeight={selected ? "bold" : "normal"}>
              {`${selected ? "\u25B8" : " "} # ${ch.name}`}
            </term:text>
            <term:text flexGrow={1} textAlign="right">
              {`${ch.threadCount} ${ch.threadCount === 1 ? "thread" : "threads"}  |  ${timeAgo(ch.lastActivityAt, now)}`}
            </term:text>
          </term:div>
        );
      })}
    </term:div>
  );
}

function ListView({
  posts,
  selectedIndex,
  listItemRefs,
  now,
  theme
}: {
  posts: BrowseListPost[];
  selectedIndex: number;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  theme: BrowseTheme;
}) {
  if (posts.length === 0) {
    return (
      <term:div flexDirection="column" padding={[1, 2]}>
        <term:text fontWeight="bold" color={theme.warning}>
          No threads found.
        </term:text>
        <term:text color={theme.muted}>Press c to change channel, u to refresh, or Tab to browse channels.</term:text>
      </term:div>
    );
  }

  const items: React.ReactNode[] = [];

  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    const selected = index === selectedIndex;
    const icon = statusIcon(post.status);
    const bg = selected ? theme.selected : undefined;
    const fg = selected ? theme.selectedFg : theme.fg;
    const mutedFg = selected ? theme.selectedFg : theme.muted;
    const pointer = selected ? "\u25B8" : " ";
    const statusColor = selected ? theme.selectedFg : getStatusTone(post.status).backgroundColor;
    const typeColor = selected ? theme.selectedFg : getPostTypeTone(post.type).backgroundColor;
    const channelColor = selected ? theme.selectedFg : theme.accent;
    const replyActorColor = selected ? theme.selectedFg : theme.success;
    const time = timeAgo(post.lastActivityAt, now);
    const right = `${post.replyCount}\u2709  ${time}`;

    if (index > 0) {
      items.push(
        <term:text key={`sep-${post.id}`} color={theme.muted} whiteSpace="pre" padding={[0, 1]}>
          {"\u2500".repeat(72)}
        </term:text>
      );
    }

    items.push(
      <term:div
        key={post.id}
        ref={(element: TermElement | null) => {
          listItemRefs.current[index] = element;
        }}
        flexDirection="column"
        backgroundColor={bg}
        padding={[0, 1]}
      >
        <term:div flexDirection="row">
          <term:text color={selected ? theme.accent : theme.muted} whiteSpace="pre">
            {`${pointer} `}
          </term:text>
          <term:text color={statusColor} fontWeight="bold" whiteSpace="pre">
            {`${icon}  `}
          </term:text>
          <term:text color={fg} fontWeight="bold">
            {sanitizeTerminalText(post.title)}
          </term:text>
          <term:text color={mutedFg} flexGrow={1} textAlign="right" whiteSpace="pre">
            {right}
          </term:text>
        </term:div>
        <term:div flexDirection="row" whiteSpace="pre">
          <term:text whiteSpace="pre" color={mutedFg}>{"     "}</term:text>
          <term:text color={typeColor}>{post.type}</term:text>
          {post.severity ? (
            <>
              <term:text color={mutedFg} whiteSpace="pre">{" \u00B7 "}</term:text>
              <term:text color={selected ? theme.selectedFg : severityColor(post.severity)} fontWeight="bold">
                {post.severity.toUpperCase()}
              </term:text>
            </>
          ) : null}
          {post.blocking ? (
            <>
              <term:text color={mutedFg} whiteSpace="pre">{" \u00B7 "}</term:text>
              <term:text color={selected ? theme.selectedFg : "red"} fontWeight="bold">
                {"BLOCKING"}
              </term:text>
            </>
          ) : null}
          <term:text color={mutedFg} whiteSpace="pre">{" \u00B7 "}</term:text>
          <term:text color={channelColor}>{`#${post.channel}`}</term:text>
          <term:text color={mutedFg} whiteSpace="pre">{` \u00B7 by ${post.actor ?? "unknown"}`}</term:text>
          {post.assignedTo ? (
            <term:text color={mutedFg} whiteSpace="pre">{` \u00B7 owner ${post.assignedTo}`}</term:text>
          ) : null}
        </term:div>
        {post.lastReplyExcerpt ? (
          <term:div flexDirection="row" whiteSpace="pre">
            <term:text color={mutedFg} whiteSpace="pre">{"     \u2514 "}</term:text>
            <term:text color={replyActorColor} fontWeight="bold">{post.lastReplyActor ?? "?"}</term:text>
            <term:text color={mutedFg} whiteSpace="pre">{`: ${sanitizeTerminalText(post.lastReplyExcerpt)}`}</term:text>
          </term:div>
        ) : null}
      </term:div>
    );
  }

  return (
    <term:div flexDirection="column" padding={[0, 0]}>
      {items}
    </term:div>
  );
}

function PostView({
  bundle,
  actor,
  now,
  theme,
  focusedIndex,
  conversationItems,
  conversationFilterMode,
  conversationSortMode,
  itemRefs,
  indexScrollRef,
  contentScrollRef,
  panelFocus,
  readProgressLabel
}: {
  bundle: ReadPostBundle | null;
  actor?: string;
  now: Date;
  theme: BrowseTheme;
  focusedIndex: number;
  conversationItems: ConversationItem[];
  conversationFilterMode: ConversationFilterMode;
  conversationSortMode: ConversationSortMode;
  itemRefs: React.MutableRefObject<Array<TermElement | null>>;
  indexScrollRef: React.MutableRefObject<TermElement | null>;
  contentScrollRef: React.MutableRefObject<TermElement | null>;
  panelFocus: "index" | "content";
  readProgressLabel: string;
}) {
  if (!bundle) {
    return <term:text>Select a post to open it.</term:text>;
  }

  const bodyFocused = focusedIndex === -1;
  const selectedReply = focusedIndex >= 0 ? bundle.replies[focusedIndex] ?? null : null;

  return (
    <term:div flexDirection="row" padding={[0, 1]} height="100%">
      <term:div
        ref={indexScrollRef}
        width={24}
        flexShrink={0}
        overflow="scroll"
        border="rounded"
        borderColor={panelFocus === "index" ? theme.accent : theme.muted}
        padding={[0, 1]}
        marginRight={1}
      >
        <term:div flexDirection="row" marginBottom={0}>
          <term:text color={panelFocus === "index" ? theme.accent : theme.fg} fontWeight="bold">
            {"Conversation"}
          </term:text>
          <term:text color={theme.muted} flexGrow={1} textAlign="right">
            {`${conversationItems.length}/${bundle.replies.length + 1}`}
          </term:text>
        </term:div>
        <term:text color={theme.muted} marginBottom={1}>
          {`[f] ${describeConversationFilterMode(conversationFilterMode)}  [s] ${conversationSortMode === "thread" ? "thr" : "new"}`}
        </term:text>

        {conversationItems.length === 0 ? (
          <term:text color={theme.muted}>No replies yet.</term:text>
        ) : (
          conversationItems.map((item, itemIndex) => {
            const focused = item.replyIndex === focusedIndex;
            return (
              <term:div
                key={item.id}
                ref={(el: TermElement | null) => {
                  itemRefs.current[itemIndex] = el;
                }}
                border={focused ? "modern" : "rounded"}
                borderColor={focused ? theme.accent : theme.muted}
                backgroundColor={focused ? theme.selected : undefined}
                padding={[0, 1]}
                marginBottom={1}
              >
                <term:text color={focused ? theme.selectedFg : theme.fg} fontWeight="bold">
                  {`${focused ? "\u25B8 " : "  "}${item.label}`}
                </term:text>
                <term:text color={focused ? theme.selectedFg : theme.muted}>
                  {timeAgo(item.createdAt, now)}
                </term:text>
              </term:div>
            );
          })
        )}
      </term:div>

      <term:div
        ref={contentScrollRef}
        flexGrow={1}
        flexShrink={1}
        overflow="scroll"
        border="rounded"
        borderColor={panelFocus === "content" ? theme.accent : theme.muted}
        padding={[0, 1]}
      >
        <term:text color={panelFocus === "content" ? theme.accent : theme.fg} fontWeight="bold" marginBottom={1}>
          {"Content"}
        </term:text>
        {bodyFocused ? (
          <term:div flexDirection="column">
            <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
              {"Original post"}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {`${bundle.post.actor ?? actor ?? "unknown"}${bundle.post.session ? ` [${bundle.post.session}]` : ""}  \u00B7  ${timeAgo(bundle.post.createdAt, now)}`}
            </term:text>
            <term:text whiteSpace="preWrap" color={theme.fg}>
              {sanitizeTerminalText(bundle.post.body)}
            </term:text>
            {bundle.post.refId ? (
              <term:text color={theme.accent} marginTop={1}>
                {`Referenced post: ${bundle.post.refId}`}
              </term:text>
            ) : null}
            {bundle.reactions.length > 0 ? (
              <>
                <term:text color={theme.accent} fontWeight="bold" marginTop={1}>
                  {"Reactions"}
                </term:text>
                <term:text color={theme.warning}>
                  {bundle.reactions.map((r) => `${r.reaction} (${r.actor ?? "unknown"})`).join("  \u00B7  ")}
                </term:text>
              </>
            ) : null}
          </term:div>
        ) : selectedReply ? (
          <term:div flexDirection="column">
            <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
              {`Reply ${focusedIndex + 1}`}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {`${selectedReply.actor ?? "unknown"}${selectedReply.session ? ` [${selectedReply.session}]` : ""}  \u00B7  ${timeAgo(selectedReply.createdAt, now)}`}
            </term:text>
            <term:text whiteSpace="preWrap" color={theme.fg}>
              {sanitizeTerminalText(selectedReply.body)}
            </term:text>
          </term:div>
        ) : null}
        <term:text color={theme.muted} marginTop={1} textAlign="right">
          {readProgressLabel}
        </term:text>
      </term:div>
    </term:div>
  );
}

function ReplyView({
  bundle,
  replyBody,
  actor,
  inputRef,
  onReplyBodyChange,
  theme
}: {
  bundle: ReadPostBundle | null;
  replyBody: string;
  actor?: string;
  inputRef: React.MutableRefObject<TermInput | null>;
  onReplyBodyChange: (value: string) => void;
  theme: BrowseTheme;
}) {
  if (!bundle) {
    return <term:text>Select a post before replying.</term:text>;
  }

  return (
    <term:div flexDirection="column" padding={[0, 1]}>
      <term:div flexDirection="row" marginBottom={1}>
        <term:text color={theme.accent} fontWeight="bold">
          {sanitizeTerminalText(`\u270E Replying to: ${bundle.post.title}`)}
        </term:text>
        <term:text color={theme.muted} flexGrow={1} textAlign="right">
          {bundle.post.id}
        </term:text>
      </term:div>
      <term:text color={theme.muted} marginBottom={1}>
        {`by you (${actor ?? "unknown"}) \u00B7 #${bundle.post.channel}`}
      </term:text>
      <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
        {"\u2500\u2500 Your reply \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"}
      </term:text>
      <term:input
        ref={inputRef}
        border="modern"
        borderColor={theme.accent}
        multiline
        autoHeight
        padding={[0, 1]}
        text={replyBody}
        onChange={(event: { target: { text: string } }) => {
          onReplyBodyChange(event.target.text);
        }}
      />
    </term:div>
  );
}

function ShortcutsModal({
  view,
  theme,
  scrollRef
}: {
  view: ViewMode;
  theme: BrowseTheme;
  scrollRef: React.MutableRefObject<TermElement | null>;
}) {
  const sections = [
    {
      title: "Global",
      entries: [
        "? show or hide this help",
        "t cycle theme",
        "a toggle auto refresh",
        "q or Ctrl+C quit"
      ]
    },
    {
      title: "Thread list",
      entries: [
        "\u2191/\u2193 move selection",
        "Enter open thread",
        "c cycle channel filter",
        "o cycle thread sort",
        "u refresh",
        "d delete selected thread",
        "Tab open channels"
      ]
    },
    {
      title: "Conversation view",
      entries: [
        "\u2190/\u2192 switch panel",
        "\u2191/\u2193 navigate items or scroll content",
        "PgUp/PgDn jump between visible items",
        "f cycle conversation filter",
        "s cycle conversation sort",
        "y copy selected body",
        "g open referenced post",
        "r write reply",
        "b or Esc go back"
      ]
    },
    {
      title: "Reply editor",
      entries: [
        "Ctrl+Enter or Ctrl+S send reply",
        "Esc cancel",
        "Ctrl+Y copy draft"
      ]
    },
    {
      title: "Channels",
      entries: [
        "\u2191/\u2193 move selection",
        "Enter apply channel",
        "Tab back to threads"
      ]
    }
  ];

  return (
    <term:div
      position="absolute"
      top={2}
      left={4}
      right={4}
      bottom={2}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[1, 2]}
      flexDirection="column"
    >
      <term:div flexDirection="row" marginBottom={1}>
        <term:text color={theme.accent} fontWeight="bold">
          {"Shortcuts"}
        </term:text>
        <term:text color={theme.muted} flexGrow={1} textAlign="right">
          {`context: ${view}  |  ? or Esc close`}
        </term:text>
      </term:div>

      <term:div ref={scrollRef} flexGrow={1} flexShrink={1} overflow="scroll" padding={[0, 0]}>
        {sections.map((section) => (
          <term:div key={section.title} marginBottom={1} flexDirection="column">
            <term:text color={theme.accent} fontWeight="bold">
              {section.title}
            </term:text>
            {section.entries.map((entry) => (
              <term:text key={`${section.title}-${entry}`} color={theme.fg}>
                {`- ${entry}`}
              </term:text>
            ))}
          </term:div>
        ))}
      </term:div>
    </term:div>
  );
}

function PostContextBar({
  bundle,
  focusedReplyIndex,
  actor,
  now,
  theme
}: {
  bundle: ReadPostBundle;
  focusedReplyIndex: number;
  actor?: string;
  now: Date;
  theme: BrowseTheme;
}) {
  const isBody = focusedReplyIndex === -1;
  const reply = !isBody ? bundle.replies[focusedReplyIndex] : null;

  const who = isBody
    ? bundle.post.actor ?? actor ?? "unknown"
    : reply?.actor ?? "unknown";
  const when = isBody
    ? timeAgo(bundle.post.createdAt, now)
    : reply ? timeAgo(reply.createdAt, now) : "";
  const session = isBody ? bundle.post.session : reply?.session ?? null;
  const tags = bundle.post.tags;
  const label = isBody ? "Original post" : `Reply ${focusedReplyIndex + 1}/${bundle.replies.length}`;

  return (
    <term:div border="rounded" borderColor={theme.accent} padding={[0, 1]} marginBottom={0} flexDirection="column">
      <term:div flexDirection="row">
        <StatusBadge label={bundle.post.type.toUpperCase()} tone={getPostTypeTone(bundle.post.type)} />
        <StatusBadge label={bundle.post.status.toUpperCase()} tone={getStatusTone(bundle.post.status)} />
        {bundle.post.severity ? (
          <term:text
            color={theme.bg}
            backgroundColor={severityColor(bundle.post.severity)}
            padding={[0, 1]}
            marginRight={1}
            fontWeight="bold"
          >
            {bundle.post.severity.toUpperCase()}
          </term:text>
        ) : null}
        {bundle.post.blocking ? (
          <term:text color="white" backgroundColor="red" padding={[0, 1]} marginRight={1} fontWeight="bold">
            {"BLOCKING"}
          </term:text>
        ) : null}
        <term:text color={theme.fg} fontWeight="bold" whiteSpace="pre">
          {`${label}  `}
        </term:text>
        <term:text color={theme.success} fontWeight="bold">{who}</term:text>
        {session ? (
          <term:text color={theme.muted} whiteSpace="pre">{` [${session}]`}</term:text>
        ) : null}
        <term:text color={theme.muted} whiteSpace="pre">{`  \u00B7  ${when}`}</term:text>
        {bundle.post.assignedTo ? (
          <term:text color={theme.accent} whiteSpace="pre">{`  \u00B7  owner ${bundle.post.assignedTo}`}</term:text>
        ) : null}
        {tags.length > 0 ? (
          <term:text color={theme.warning} whiteSpace="pre">{`  \u00B7  ${tags.map(t => `#${t}`).join(" ")}`}</term:text>
        ) : null}
      </term:div>
      {bundle.post.refId || bundle.post.idempotencyKey ? (
        <term:div flexDirection="row">
          {bundle.post.refId ? (
            <term:text color={theme.accent} whiteSpace="pre">{`ref: ${bundle.post.refId}`}</term:text>
          ) : null}
          {bundle.post.idempotencyKey ? (
            <term:text color={theme.muted} whiteSpace="pre">
              {`${bundle.post.refId ? "  \u00B7  " : ""}idem: ${bundle.post.idempotencyKey}`}
            </term:text>
          ) : null}
        </term:div>
      ) : null}
    </term:div>
  );
}

function StatusBadge({
  label,
  tone
}: {
  label: string;
  tone: { color: string; backgroundColor: string };
}) {
  return (
    <term:text
      color={tone.color}
      backgroundColor={tone.backgroundColor}
      padding={[0, 1]}
      marginRight={1}
      fontWeight="bold"
    >
      {label}
    </term:text>
  );
}

function breadcrumb(view: ViewMode, channelFilter: string, bundle: ReadPostBundle | null, focusedReplyIndex = -1): string {
  const root = "AgentForum";
  const channel = channelFilter === ALL_CHANNELS ? "all channels" : `#${channelFilter}`;

  if (view === "channels") {
    return `${root} \u203A Channels`;
  }

  if (view === "list") {
    return `${root} \u203A ${channel}`;
  }

  if ((view === "post" || view === "reply") && bundle) {
    const safeTitle = sanitizeTerminalText(bundle.post.title);
    const title = safeTitle.length > 40 ? safeTitle.slice(0, 39) + "\u2026" : safeTitle;
    const base = `${root} \u203A #${bundle.post.channel} \u203A ${title}`;

    if (view === "reply") {
      return `${base} \u203A Writing reply`;
    }

    if (focusedReplyIndex >= 0) {
      return `${base} \u203A Reply #${focusedReplyIndex + 1}`;
    }

    return base;
  }

  return root;
}

function scrollBy(element: TermElement | null, delta: number): void {
  if (!element) {
    return;
  }

  element.scrollTop = Math.max(0, element.scrollTop + delta);
}

function syncFocusToScroll(
  container: TermElement | null,
  itemRefs: Array<TermElement | null>,
  setIndex: React.Dispatch<React.SetStateAction<number>>
): void {
  if (!container || itemRefs.length === 0) {
    return;
  }

  const viewportMid = container.elementWorldRect.y + container.offsetHeight / 2;

  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < itemRefs.length; i++) {
    const el = itemRefs[i];
    if (!el) continue;
    const elMid = el.elementWorldRect.y + el.offsetHeight / 2;
    const dist = Math.abs(elMid - viewportMid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) {
    setIndex(bestIndex - 1);
  }
}

function noticeColor(notice: Notice): string | null {
  if (!notice) {
    return null;
  }

  return notice.kind === "error" ? "red" : "green";
}

function formatRefreshClock(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isUpKey(key: KeyLike): boolean {
  return key.name === "up" || key.sequence === "\u001B[A";
}

function isDownKey(key: KeyLike): boolean {
  return key.name === "down" || key.sequence === "\u001B[B";
}

function isLeftKey(key: KeyLike): boolean {
  return key.name === "left" || key.sequence === "\u001B[D";
}

function isRightKey(key: KeyLike): boolean {
  return key.name === "right" || key.sequence === "\u001B[C";
}

function isEnterKey(key: KeyLike): boolean {
  return key.name === "enter" || key.name === "return" || key.sequence === "\r" || key.sequence === "\n";
}

function isEscapeKey(key: KeyLike): boolean {
  return key.name === "escape" || key.sequence === "\u001B";
}

function isTabKey(key: KeyLike): boolean {
  return key.name === "tab" || key.sequence === "\t";
}

function isPgUpKey(key: KeyLike): boolean {
  return key.name === "pgup" || key.name === "pageup" || key.sequence === "\u001B[5~";
}

function isPgDownKey(key: KeyLike): boolean {
  return key.name === "pgdn" || key.name === "pagedown" || key.sequence === "\u001B[6~";
}

function isCharacterKey(key: KeyLike, value: string): boolean {
  return !key.ctrl && !key.alt && !key.meta && (key.name === value || key.sequence === value);
}

function isCtrlKey(key: KeyLike, value: string): boolean {
  return key.ctrl && (key.name === value || key.sequence.toLowerCase() === value.toLowerCase());
}
