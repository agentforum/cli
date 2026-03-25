import type { PostFilters } from "@/domain/filters.js";
import type { ReadPostBundle, SearchMatchKind } from "@/domain/post.js";
import type { ReactionRecord } from "@/domain/reaction.js";
import type {
  BrowseSortMode,
  ConversationFilterMode,
  ConversationSortMode,
  ListDisplayMode,
  Notice,
  ViewMode,
} from "./types.js";
import { ALL_CHANNELS } from "./types.js";

const TERMINAL_TEXT_REPLACEMENTS: Record<string, string> = {
  "🟢": "[green]",
  "🟡": "[yellow]",
  "🔴": "[red]",
  "✅": "[ok]",
  "❌": "[x]",
  "⚠️": "[warn]",
  "⚠": "[warn]",
  ℹ️: "[info]",
  ℹ: "[info]",
};

export function excerpt(text: string, maxLength = 80): string {
  const oneLine = text.replace(/\n/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return oneLine.slice(0, maxLength - 1) + "\u2026";
}

export function excerptAroundMatch(text: string, query: string, maxLength = 80): string {
  const oneLine = text.replace(/\n/g, " ").trim();
  if (!query.trim() || oneLine.length <= maxLength) {
    return excerpt(oneLine, maxLength);
  }

  const normalizedText = oneLine.toLocaleLowerCase();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchIndex = normalizedText.indexOf(normalizedQuery);
  if (matchIndex < 0) {
    return excerpt(oneLine, maxLength);
  }

  const prefix = "\u2026";
  const suffix = "\u2026";
  const reserved =
    (matchIndex > 0 ? prefix.length : 0) + (oneLine.length > maxLength ? suffix.length : 0);
  const available = Math.max(normalizedQuery.length, maxLength - reserved);
  let start = Math.max(0, matchIndex - Math.floor((available - normalizedQuery.length) / 2));
  const end = Math.min(oneLine.length, start + available);
  start = Math.max(0, end - available);

  const hasPrefix = start > 0;
  const hasSuffix = end < oneLine.length;
  const raw = oneLine.slice(start, end);
  return `${hasPrefix ? prefix : ""}${raw}${hasSuffix ? suffix : ""}`;
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

export function splitHighlightedText(text: string, query: string): HighlightSegment[] {
  if (!text) {
    return [{ text: "", match: false }];
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [{ text, match: false }];
  }

  const start = text.toLocaleLowerCase().indexOf(normalizedQuery);
  if (start < 0) {
    return [{ text, match: false }];
  }

  const end = start + normalizedQuery.length;
  return [
    ...(start > 0 ? [{ text: text.slice(0, start), match: false }] : []),
    { text: text.slice(start, end), match: true },
    ...(end < text.length ? [{ text: text.slice(end), match: false }] : []),
  ];
}

export function describeSearchMatchKind(kind: SearchMatchKind): string {
  switch (kind) {
    case "title":
      return "TITLE";
    case "tag":
      return "TAG";
    case "author":
      return "AUTHOR";
    case "session":
      return "SESSION";
    case "assigned":
      return "OWNER";
    case "body":
      return "BODY";
    case "reply-author":
      return "R.AUTHOR";
    case "reply-session":
      return "R.SESSION";
    case "reply-body":
      return "REPLY";
  }
}

export function sanitizeTerminalText(text: string): string {
  let sanitized = text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[\u200D\uFE0E\uFE0F]/g, "");

  sanitized = sanitized.replace(
    /[\u{10000}-\u{10FFFF}]/gu,
    (symbol) => TERMINAL_TEXT_REPLACEMENTS[symbol] ?? "[?]"
  );

  return sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export function describeRefreshMs(refreshMs: number): string {
  const seconds = Math.max(1, Math.ceil(refreshMs / 1000));
  return seconds === 1 ? "1s" : `${seconds}s`;
}

export function buildAutoRefreshLabel(
  autoRefreshEnabled: boolean,
  refreshMs: number,
  remainingMs?: number | null
): string {
  if (!autoRefreshEnabled) {
    return "auto off";
  }

  if (remainingMs == null) {
    return `auto ${describeRefreshMs(refreshMs)}`;
  }

  return `auto ${describeRefreshMs(refreshMs)}  |  next ${describeRefreshMs(Math.max(0, remainingMs))}`;
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
    `last: ${options.lastRefreshAt}`,
  ];

  return parts.filter(Boolean).join("  |  ");
}

export function statusIcon(status: string): string {
  switch (status) {
    case "answered":
      return "\u2713";
    case "open":
      return "\u25CB";
    case "wont-answer":
      return "\u2717";
    case "stale":
      return "~";
    case "needs-clarification":
      return "?";
    default:
      return "\u25CB";
  }
}

export function reactionIcon(reaction: string): string {
  switch (reaction) {
    case "confirmed":
      return "+";
    case "contradicts":
      return "!";
    case "acting-on":
      return ">";
    case "needs-human":
      return "@";
    default:
      return "*";
  }
}

export function describeReaction(reaction: string): string {
  switch (reaction) {
    case "confirmed":
      return "Confirmed";
    case "contradicts":
      return "Contradicts";
    case "acting-on":
      return "Acting on it";
    case "needs-human":
      return "Needs human";
    default:
      return sanitizeTerminalText(reaction);
  }
}

export function summarizeReactions(reactions: ReactionRecord[]): string[] {
  const groups = new Map<
    string,
    {
      reaction: string;
      count: number;
      actors: string[];
    }
  >();

  for (const reaction of reactions) {
    const existing = groups.get(reaction.reaction);
    const actor = sanitizeTerminalText(reaction.actor ?? "unknown");
    if (existing) {
      existing.count += 1;
      if (!existing.actors.includes(actor)) {
        existing.actors.push(actor);
      }
      continue;
    }

    groups.set(reaction.reaction, {
      reaction: reaction.reaction,
      count: 1,
      actors: [actor],
    });
  }

  return [...groups.values()].map((group) => {
    const countLabel = group.count === 1 ? "x1" : `x${group.count}`;
    const actorsLabel = group.actors.join(", ");
    return `${reactionIcon(group.reaction)} ${sanitizeTerminalText(group.reaction)} ${countLabel} by ${actorsLabel}`;
  });
}

export function buildBrowseHint(view: ViewMode, postCount: number): string {
  if (view === "reply") {
    return "Tab/Shift+Tab focus panes  |  j/k move quotes  |  PgUp/PgDn scroll preview  |  Ctrl+S send";
  }

  if (view === "compose-post") {
    return "Tab/Shift+Tab fields  |  left list follows focus  |  ←/→ options  |  Ctrl+S create post";
  }

  if (view === "compose-subscription") {
    return "Tab/Shift+Tab fields  |  left list follows focus  |  ←/→ mode  |  Ctrl+S save subscription";
  }

  if (view === "reader") {
    return "\u2191\u2193 scroll  |  PgUp/PgDn fast scroll  |  j/k or n/p prev/next item  |  e react  |  [ ] refs  |  g open ref  |  w toggle quote";
  }

  if (view === "post") {
    return "\u2190\u2192 panel  |  \u2191\u2193 navigate/scroll  |  Enter reader  |  PgUp/PgDn fast scroll  |  e react  |  [ ] refs  |  g open ref  |  w toggle quote  |  r reply";
  }

  if (view === "channels") {
    return "\u2191\u2193 navigate  |  Enter select  |  n new post  |  s subscribe  |  Esc/Tab threads";
  }

  if (postCount === 0) {
    return "u refresh  |  n new post  |  c channel  |  o sort  |  / search  |  Esc channels";
  }

  return "\u2191\u2193 navigate  |  Enter open  |  n new post  |  PgUp/PgDn or [ ] pages  |  / search";
}

export function describeListDisplayMode(mode: ListDisplayMode): string {
  switch (mode) {
    case "compact":
      return "compact";
    case "semantic":
      return "semantic";
  }
}

export function timeAgo(isoDate: string, now?: Date): string {
  const date = new Date(isoDate);
  const then = date.getTime();
  const referenceDate = now ?? new Date();
  const reference = referenceDate.getTime();
  const diffMs = Math.max(0, reference - then);

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const includeYear = date.getFullYear() !== referenceDate.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
  });
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

export function buildReadProgressLabel(
  scrollTop: number,
  scrollHeight: number,
  viewportHeight: number
): string {
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

export function buildPageLabel(
  page: number,
  totalPages: number,
  rangeStart: number,
  rangeEnd: number,
  totalCount: number
): string {
  if (totalCount <= 0) {
    return "page 1/1  (0 of 0)";
  }

  return `page ${page}/${totalPages}  (${rangeStart}\u2013${rangeEnd} of ${totalCount})`;
}

export function estimateTokenCount(text: string): number {
  if (!text) {
    return 0;
  }

  return Math.max(1, Math.ceil(text.length / 4));
}

export function breadcrumb(
  view: ViewMode,
  channelFilter: string,
  bundle: ReadPostBundle | null,
  focusedReplyIndex = -1
): string {
  const root = "AgentForum";
  const channel = channelFilter === ALL_CHANNELS ? "all channels" : `#${channelFilter}`;

  if (view === "channels") {
    return `${root} \u203A Channels`;
  }

  if (view === "list") {
    return `${root} \u203A ${channel}`;
  }

  if (
    (view === "post" ||
      view === "reader" ||
      view === "reply" ||
      view === "compose-post" ||
      view === "compose-subscription") &&
    bundle
  ) {
    const safeTitle = sanitizeTerminalText(bundle.post.title);
    const title = safeTitle.length > 40 ? safeTitle.slice(0, 39) + "\u2026" : safeTitle;
    const base = `${root} \u203A #${bundle.post.channel} \u203A ${title}`;

    if (view === "reply") {
      return `${base} \u203A Writing reply`;
    }

    if (view === "reader") {
      return `${base} \u203A Reading`;
    }

    if (view === "compose-post") {
      return `${base} \u203A New post`;
    }

    if (view === "compose-subscription") {
      return `${base} \u203A Channel subscription`;
    }

    if (focusedReplyIndex >= 0) {
      return `${base} \u203A Reply #${focusedReplyIndex + 1}`;
    }

    return base;
  }

  if (view === "compose-post") {
    return channelFilter === ALL_CHANNELS
      ? `${root} \u203A New post`
      : `${root} \u203A ${channel} \u203A New post`;
  }

  if (view === "compose-subscription") {
    return channelFilter === ALL_CHANNELS
      ? `${root} \u203A Channel subscription`
      : `${root} \u203A ${channel} \u203A Channel subscription`;
  }

  return root;
}

export function noticeColor(
  notice: Notice,
  theme?: { danger: string; success: string; info: string }
): string | null {
  if (!notice) {
    return null;
  }

  if (!theme) {
    return notice.kind === "error" ? "red" : "green";
  }

  return notice.kind === "error" ? theme.danger : theme.info;
}

export function formatRefreshClock(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
