import { AgentForumError, type PostFilters, type PostRecord, type PostStatus, type PostType, type ReadPostBundle, type Severity } from "../../domain/types.js";

export const DEFAULT_REFRESH_MS = 5000;
export const ALL_CHANNELS = "__all__";
export const SORT_MODES = ["activity", "recent", "title", "channel"] as const;
export type BrowseSortMode = (typeof SORT_MODES)[number];
export const CONVERSATION_SORT_MODES = ["thread", "recent"] as const;
export type ConversationSortMode = (typeof CONVERSATION_SORT_MODES)[number];
export const CONVERSATION_FILTER_MODES = ["all", "original", "replies"] as const;
export type ConversationFilterMode = (typeof CONVERSATION_FILTER_MODES)[number];

export interface BrowseListPost extends PostRecord {
  lastActivityAt: string;
  replyCount: number;
  reactionCount: number;
  lastReplyExcerpt: string | null;
  lastReplyActor: string | null;
}

export interface ConversationItem {
  id: string;
  kind: "post" | "reply";
  label: string;
  actor: string | null;
  session: string | null;
  createdAt: string;
  body: string;
  replyIndex: number;
}

export function excerpt(text: string, maxLength = 80): string {
  const oneLine = text.replace(/\n/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return oneLine.slice(0, maxLength - 1) + "\u2026";
}

const TERMINAL_TEXT_REPLACEMENTS: Record<string, string> = {
  "🟢": "[green]",
  "🟡": "[yellow]",
  "🔴": "[red]",
  "✅": "[ok]",
  "❌": "[x]",
  "⚠️": "[warn]",
  "⚠": "[warn]",
  "ℹ️": "[info]",
  "ℹ": "[info]"
};

export function sanitizeTerminalText(text: string): string {
  let sanitized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[\u200D\uFE0E\uFE0F]/g, "");

  sanitized = sanitized.replace(/[\u{10000}-\u{10FFFF}]/gu, (symbol) => TERMINAL_TEXT_REPLACEMENTS[symbol] ?? "[?]");

  return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export interface ChannelStats {
  name: string;
  threadCount: number;
  lastActivityAt: string;
}

// prettier-ignore
export const ASCII_BANNER = [
  "    _                    _   _____",
  "   / \\   __ _  ___ _ __ | |_|  ___|__  _ __ _   _ _ __ ___",
  "  / _ \\ / _` |/ _ \\ '_ \\| __| |_ / _ \\| '__| | | | '_ ` _ \\",
  " / ___ \\ (_| |  __/ | | | |_|  _| (_) | |  | |_| | | | | | |",
  "/_/   \\_\\__, |\\___|_| |_|\\__|_|  \\___/|_|   \\__,_|_| |_| |_|",
  "        |___/"
].join("\n");

export interface BrowseTheme {
  name: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  banner: string;
  selected: string;
  selectedFg: string;
  success: string;
  warning: string;
}

export const THEMES: BrowseTheme[] = [
  {
    name: "dark",
    bg: "black",
    fg: "white",
    accent: "cyan",
    muted: "#666666",
    banner: "cyan",
    selected: "blue",
    selectedFg: "white",
    success: "green",
    warning: "yellow",
  },
  {
    name: "green",
    bg: "black",
    fg: "green",
    accent: "#00ff88",
    muted: "#336633",
    banner: "green",
    selected: "#005500",
    selectedFg: "#00ff88",
    success: "#00ff88",
    warning: "yellow",
  },
  {
    name: "ocean",
    bg: "#0a0a2e",
    fg: "#ccddff",
    accent: "#5599ff",
    muted: "#445588",
    banner: "#5599ff",
    selected: "#223366",
    selectedFg: "#ffffff",
    success: "#44cc88",
    warning: "#ffaa44",
  },
  {
    name: "amber",
    bg: "#1a1000",
    fg: "#ffcc44",
    accent: "#ffaa00",
    muted: "#665500",
    banner: "#ffaa00",
    selected: "#443300",
    selectedFg: "#ffee88",
    success: "#ffcc44",
    warning: "#ff8800",
  },
  {
    name: "pink",
    bg: "#1a0011",
    fg: "#ffaacc",
    accent: "#ff66aa",
    muted: "#774455",
    banner: "#ff66aa",
    selected: "#442233",
    selectedFg: "#ffddee",
    success: "#66ff99",
    warning: "#ffcc66",
  },
];

export function parseLimit(rawLimit?: string): number {
  if (!rawLimit) {
    return 30;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new AgentForumError("--limit must be a positive integer.", 3);
  }

  return limit;
}

export function parseRefreshMs(rawRefreshMs?: string): number {
  if (!rawRefreshMs) {
    return DEFAULT_REFRESH_MS;
  }

  const refreshMs = Number(rawRefreshMs);
  if (!Number.isInteger(refreshMs) || refreshMs < 1000) {
    throw new AgentForumError("--refresh-ms must be an integer >= 1000.", 3);
  }

  return refreshMs;
}

export function resolveSelectedIndex(posts: PostRecord[], currentIndex: number, focusedId?: string): number {
  if (posts.length === 0) {
    return 0;
  }

  if (focusedId) {
    const focusedIndex = posts.findIndex((post) => post.id === focusedId);
    if (focusedIndex >= 0) {
      return focusedIndex;
    }
  }

  return Math.min(currentIndex, posts.length - 1);
}

export function buildBrowseFilters(options: {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  pinned?: boolean;
  unreadForSession?: string;
  subscribedForActor?: string;
  assignedTo?: string;
  waitingForActor?: string;
  limit: number;
}): PostFilters {
  return {
    channel: options.channel,
    type: options.type,
    severity: options.severity,
    status: options.status,
    tag: options.tag,
    pinned: options.pinned,
    unreadForSession: options.unreadForSession,
    subscribedForActor: options.subscribedForActor,
    assignedTo: options.assignedTo,
    waitingForActor: options.waitingForActor,
    limit: options.limit
  };
}

export function buildBaseBrowseFilters(options: {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  pinned?: boolean;
  unreadForSession?: string;
  subscribedForActor?: string;
  assignedTo?: string;
  waitingForActor?: string;
}): PostFilters {
  return {
    channel: options.channel,
    type: options.type,
    severity: options.severity,
    status: options.status,
    tag: options.tag,
    pinned: options.pinned,
    unreadForSession: options.unreadForSession,
    subscribedForActor: options.subscribedForActor,
    assignedTo: options.assignedTo,
    waitingForActor: options.waitingForActor
  };
}

export function describeRefreshMs(refreshMs: number): string {
  if (refreshMs % 1000 === 0) {
    const seconds = refreshMs / 1000;
    return seconds === 1 ? "1s" : `${seconds}s`;
  }

  return `${refreshMs}ms`;
}

export function buildFilterSummary(
  filters: PostFilters,
  postCount: number,
  options: {
    autoRefreshEnabled: boolean;
    refreshMs: number;
    lastRefreshAt: string;
    sortMode: BrowseSortMode;
  }
): string {
  const parts = [
    filters.channel ? `channel: ${filters.channel}` : "channel: all",
    filters.type ? `type: ${filters.type}` : "type: all",
    filters.severity ? `severity: ${filters.severity}` : null,
    filters.status ? `status: ${filters.status}` : "status: all",
    filters.tag ? `tag: #${filters.tag}` : null,
    filters.pinned ? "pinned only" : null,
    filters.assignedTo ? `assigned: ${filters.assignedTo}` : null,
    filters.waitingForActor ? `waiting: ${filters.waitingForActor}` : null,
    filters.subscribedForActor ? `subs: ${filters.subscribedForActor}` : null,
    filters.unreadForSession ? `unread: ${filters.unreadForSession}` : null,
    `sort: ${describeSortMode(options.sortMode)}`,
    `posts: ${postCount}`,
    `auto: ${options.autoRefreshEnabled ? `on (${describeRefreshMs(options.refreshMs)})` : "off"}`,
    `last: ${options.lastRefreshAt}`
  ];

  return parts.filter(Boolean).join("  |  ");
}

export function statusIcon(status: string): string {
  switch (status) {
    case "answered": return "\u2713";
    case "open": return "\u25CB";
    case "wont-answer": return "\u2717";
    case "stale": return "~";
    case "needs-clarification": return "?";
    default: return "\u25CB";
  }
}

export function typeIcon(type: string): string {
  switch (type) {
    case "finding": return "\u2691";
    case "question": return "?";
    case "decision": return "\u2713";
    case "note": return "\u266A";
    default: return "\u00B7";
  }
}

export function copyToClipboard(text: string): void {
  const osc52 = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`;
  process.stdout.write(osc52);
}

export function severityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "red";
    case "warning":
      return "yellow";
    case "info":
      return "cyan";
  }
}

export function buildBrowseHint(
  view: "list" | "post" | "reply" | "channels",
  postCount: number,
  options: { autoRefreshEnabled: boolean; refreshMs: number }
): string {
  if (view === "reply") {
    return "Ctrl+Enter send  |  Esc cancel  |  ? shortcuts";
  }

  if (view === "post") {
    return "\u2190\u2192 panel  |  \u2191\u2193 navigate/scroll  |  r reply  |  b back  |  ? shortcuts";
  }

  if (view === "channels") {
    return "\u2191\u2193 navigate  |  Enter select  |  Tab threads  |  ? shortcuts";
  }

  if (postCount === 0) {
    return "u refresh  |  c channel  |  o sort  |  Tab channels  |  ? shortcuts";
  }

  return "\u2191\u2193 navigate  |  Enter open  |  c channel  |  o sort  |  ? shortcuts";
}

export function timeAgo(isoDate: string, now?: Date): string {
  const then = new Date(isoDate).getTime();
  const reference = (now ?? new Date()).getTime();
  const diffMs = Math.max(0, reference - then);

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function buildChannelStats(posts: BrowseListPost[]): ChannelStats[] {
  const map = new Map<string, { count: number; lastActivity: string }>();

  for (const post of posts) {
    const entry = map.get(post.channel);
    if (!entry) {
      map.set(post.channel, { count: 1, lastActivity: post.lastActivityAt });
    } else {
      entry.count += 1;
      if (post.lastActivityAt > entry.lastActivity) {
        entry.lastActivity = post.lastActivityAt;
      }
    }
  }

  return [...map.entries()]
    .map(([name, { count, lastActivity }]) => ({
      name,
      threadCount: count,
      lastActivityAt: lastActivity
    }))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function listChannels(posts: PostRecord[]): string[] {
  return [...new Set(posts.map((post) => post.channel))].sort((left, right) => left.localeCompare(right));
}

export function nextValue<T>(values: readonly T[], current: T): T {
  const index = values.indexOf(current);
  if (index < 0 || index === values.length - 1) {
    return values[0];
  }

  return values[index + 1];
}

export function nextChannelFilter(channels: string[], current: string): string {
  return nextValue([ALL_CHANNELS, ...channels], current);
}

export function describeSortMode(sortMode: BrowseSortMode): string {
  switch (sortMode) {
    case "activity":
      return "last activity";
    case "recent":
      return "newest post";
    case "title":
      return "title (A-Z)";
    case "channel":
      return "channel (A-Z)";
  }
}

export function describeConversationSortMode(sortMode: ConversationSortMode): string {
  switch (sortMode) {
    case "thread":
      return "thread order";
    case "recent":
      return "newest first";
  }
}

export function describeConversationFilterMode(filterMode: ConversationFilterMode): string {
  switch (filterMode) {
    case "all":
      return "all";
    case "original":
      return "original";
    case "replies":
      return "replies";
  }
}

export function filterAndSortPosts(posts: BrowseListPost[], options: { channelFilter: string; sortMode: BrowseSortMode; limit: number }): BrowseListPost[] {
  const filtered = options.channelFilter === ALL_CHANNELS ? posts : posts.filter((post) => post.channel === options.channelFilter);
  const sorted = [...filtered].sort((left, right) => comparePosts(left, right, options.sortMode));
  return sorted.slice(0, options.limit);
}

export function buildConversationItems(
  bundle: ReadPostBundle,
  options: { filterMode: ConversationFilterMode; sortMode: ConversationSortMode }
): ConversationItem[] {
  const postItem: ConversationItem = {
    id: bundle.post.id,
    kind: "post",
    label: "Post original",
    actor: bundle.post.actor,
    session: bundle.post.session,
    createdAt: bundle.post.createdAt,
    body: bundle.post.body,
    replyIndex: -1
  };
  const replyItems: ConversationItem[] = bundle.replies.map((reply, index) => ({
    id: reply.id,
    kind: "reply",
    label: `Reply ${index + 1}`,
    actor: reply.actor,
    session: reply.session,
    createdAt: reply.createdAt,
    body: reply.body,
    replyIndex: index
  }));

  let items = options.filterMode === "original"
    ? [postItem]
    : options.filterMode === "replies"
      ? replyItems
      : [postItem, ...replyItems];

  if (options.sortMode === "recent") {
    items = [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.replyIndex - right.replyIndex);
  }

  return items;
}

export function resolveConversationSelection(items: ConversationItem[], focusedReplyIndex: number): number {
  if (items.length === 0) {
    return 0;
  }

  const index = items.findIndex((item) => item.replyIndex === focusedReplyIndex);
  return index >= 0 ? index : 0;
}

export function buildReadProgressLabel(scrollTop: number, scrollHeight: number, viewportHeight: number): string {
  if (scrollHeight <= 0 || viewportHeight <= 0 || scrollHeight <= viewportHeight) {
    return "[100% read]";
  }

  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  if (maxScroll === 0 || scrollTop >= maxScroll - 1) {
    return "[100% read]";
  }

  const percent = Math.max(0, Math.min(99, Math.round((scrollTop / maxScroll) * 100)));
  return `[${percent}% read]`;
}

export function getLastActivityAt(post: PostRecord, bundle?: { replies: Array<{ createdAt: string }>; reactions: Array<{ createdAt: string }> }): string {
  const timestamps = [
    post.createdAt,
    ...(bundle?.replies.map((reply) => reply.createdAt) ?? []),
    ...(bundle?.reactions.map((reaction) => reaction.createdAt) ?? [])
  ];

  return timestamps.sort((left, right) => right.localeCompare(left))[0] ?? post.createdAt;
}

function comparePosts(left: BrowseListPost, right: BrowseListPost, sortMode: BrowseSortMode): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  if (sortMode === "title") {
    return compareText(left.title, right.title) || right.createdAt.localeCompare(left.createdAt);
  }

  if (sortMode === "channel") {
    return compareText(left.channel, right.channel) || compareText(left.title, right.title) || right.createdAt.localeCompare(left.createdAt);
  }

  if (sortMode === "recent") {
    return right.createdAt.localeCompare(left.createdAt) || compareText(left.title, right.title);
  }

  return right.lastActivityAt.localeCompare(left.lastActivityAt) || right.createdAt.localeCompare(left.createdAt) || compareText(left.title, right.title);
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function getPostTypeTone(type: PostType): { color: string; backgroundColor: string } {
  switch (type) {
    case "finding":
      return { color: "black", backgroundColor: "yellow" };
    case "question":
      return { color: "black", backgroundColor: "cyan" };
    case "decision":
      return { color: "black", backgroundColor: "green" };
    case "note":
      return { color: "black", backgroundColor: "magenta" };
  }
}

export function getStatusTone(status: PostStatus): { color: string; backgroundColor: string } {
  switch (status) {
    case "open":
      return { color: "black", backgroundColor: "yellow" };
    case "answered":
      return { color: "black", backgroundColor: "green" };
    case "needs-clarification":
      return { color: "black", backgroundColor: "magenta" };
    case "wont-answer":
      return { color: "white", backgroundColor: "red" };
    case "stale":
      return { color: "black", backgroundColor: "white" };
  }
}
