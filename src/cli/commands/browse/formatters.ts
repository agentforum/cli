import type { PostFilters } from "../../../domain/filters.js";
import type { ReadPostBundle } from "../../../domain/post.js";
import type { BrowseSortMode, ConversationFilterMode, ConversationSortMode, Notice, ViewMode } from "./types.js";
import { ALL_CHANNELS } from "./types.js";

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

export function excerpt(text: string, maxLength = 80): string {
  const oneLine = text.replace(/\n/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return oneLine.slice(0, maxLength - 1) + "\u2026";
}

export function sanitizeTerminalText(text: string): string {
  let sanitized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[\u200D\uFE0E\uFE0F]/g, "");

  sanitized = sanitized.replace(/[\u{10000}-\u{10FFFF}]/gu, (symbol) => TERMINAL_TEXT_REPLACEMENTS[symbol] ?? "[?]");

  return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
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

export function buildBrowseHint(
  view: ViewMode,
  postCount: number
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

export function breadcrumb(view: ViewMode, channelFilter: string, bundle: ReadPostBundle | null, focusedReplyIndex = -1): string {
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

export function noticeColor(notice: Notice): string | null {
  if (!notice) {
    return null;
  }

  return notice.kind === "error" ? "red" : "green";
}

export function formatRefreshClock(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
