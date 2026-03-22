import type { PostFilters } from "@/domain/filters.js";
import type { PostRecord, PostStatus, PostType, ReadPostBundle, Severity } from "@/domain/types.js";
import type {
  BrowseListPost,
  BrowseSortMode,
  ChannelStats,
  ConversationFilterMode,
  ConversationItem,
  ConversationSortMode,
  PaginatedItems,
} from "./types.js";
import { ALL_CHANNELS } from "./types.js";

export function resolveSelectedIndex(
  posts: PostRecord[],
  currentIndex: number,
  focusedId?: string
): number {
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
  text?: string;
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
    text: options.text,
    pinned: options.pinned,
    unreadForSession: options.unreadForSession,
    subscribedForActor: options.subscribedForActor,
    assignedTo: options.assignedTo,
    waitingForActor: options.waitingForActor,
    limit: options.limit,
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
    waitingForActor: options.waitingForActor,
  };
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
      lastActivityAt: lastActivity,
    }))
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export function listChannels(posts: PostRecord[]): string[] {
  return [...new Set(posts.map((post) => post.channel))].sort((left, right) =>
    left.localeCompare(right)
  );
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

export function filterAndSortPosts(
  posts: BrowseListPost[],
  options: { channelFilter: string; sortMode: BrowseSortMode; limit: number; offset?: number }
): PaginatedItems<BrowseListPost> {
  const filtered =
    options.channelFilter === ALL_CHANNELS
      ? posts
      : posts.filter((post) => post.channel === options.channelFilter);
  const sorted = [...filtered].sort((left, right) => comparePosts(left, right, options.sortMode));
  return paginateItems(sorted, { limit: options.limit, offset: options.offset ?? 0 });
}

export function paginateItems<T>(
  items: T[],
  options: { limit: number; offset?: number }
): PaginatedItems<T> {
  const totalCount = items.length;
  const safeLimit = Math.max(1, options.limit);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  const maxOffset = Math.max(0, (totalPages - 1) * safeLimit);
  const offset = clampOffset(options.offset ?? 0, totalCount, safeLimit);
  const page = Math.floor(offset / safeLimit) + 1;
  const rangeStart = totalCount === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + safeLimit, totalCount);

  return {
    items: items.slice(offset, Math.min(offset + safeLimit, totalCount)),
    totalCount,
    totalPages,
    page,
    offset: Math.min(offset, maxOffset),
    rangeStart,
    rangeEnd,
  };
}

export function clampOffset(offset: number, totalCount: number, limit: number): number {
  if (totalCount <= 0) {
    return 0;
  }

  const safeLimit = Math.max(1, limit);
  const maxOffset = Math.max(0, Math.floor((totalCount - 1) / safeLimit) * safeLimit);
  return Math.max(0, Math.min(maxOffset, offset));
}

export function offsetForPage(page: number, limit: number): number {
  return Math.max(0, (Math.max(1, page) - 1) * Math.max(1, limit));
}

export function resolvePageOffsetForId<T extends { id: string }>(
  items: T[],
  options: { currentOffset: number; limit: number; focusedId?: string }
): number {
  if (items.length === 0) {
    return 0;
  }

  if (!options.focusedId) {
    return clampOffset(options.currentOffset, items.length, options.limit);
  }

  const focusedIndex = items.findIndex((item) => item.id === options.focusedId);
  if (focusedIndex < 0) {
    return clampOffset(options.currentOffset, items.length, options.limit);
  }

  return clampOffset(
    offsetForPage(Math.floor(focusedIndex / Math.max(1, options.limit)) + 1, options.limit),
    items.length,
    options.limit
  );
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
    replyIndex: -1,
    quoteRefs: [],
  };
  const replyItems: ConversationItem[] = bundle.replies.map((reply, index) => ({
    id: reply.id,
    kind: "reply",
    label: `Reply ${index + 1}`,
    actor: reply.actor,
    session: reply.session,
    createdAt: reply.createdAt,
    body: reply.body,
    replyIndex: index,
    quoteRefs: Array.isArray(reply.data?.quoteRefs) ? reply.data.quoteRefs : [],
  }));

  let items =
    options.filterMode === "original"
      ? [postItem]
      : options.filterMode === "replies"
        ? replyItems
        : [postItem, ...replyItems];

  if (options.sortMode === "recent") {
    items = [...items].sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) || left.replyIndex - right.replyIndex
    );
  }

  return items;
}

export function resolveConversationSelection(
  items: ConversationItem[],
  focusedReplyIndex: number
): number {
  if (items.length === 0) {
    return 0;
  }

  const index = items.findIndex((item) => item.replyIndex === focusedReplyIndex);
  return index >= 0 ? index : 0;
}

export function getLastActivityAt(
  post: PostRecord,
  bundle?: { replies: Array<{ createdAt: string }>; reactions: Array<{ createdAt: string }> }
): string {
  const timestamps = [
    post.createdAt,
    ...(bundle?.replies.map((reply) => reply.createdAt) ?? []),
    ...(bundle?.reactions.map((reaction) => reaction.createdAt) ?? []),
  ];

  return timestamps.sort((left, right) => right.localeCompare(left))[0] ?? post.createdAt;
}

function comparePosts(
  left: BrowseListPost,
  right: BrowseListPost,
  sortMode: BrowseSortMode
): number {
  const searchRankComparison = compareSearchRanks(left, right);
  if (searchRankComparison !== 0) {
    return searchRankComparison;
  }

  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }

  if (sortMode === "title") {
    return compareText(left.title, right.title) || right.createdAt.localeCompare(left.createdAt);
  }

  if (sortMode === "channel") {
    return (
      compareText(left.channel, right.channel) ||
      compareText(left.title, right.title) ||
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  if (sortMode === "recent") {
    return right.createdAt.localeCompare(left.createdAt) || compareText(left.title, right.title);
  }

  return (
    right.lastActivityAt.localeCompare(left.lastActivityAt) ||
    right.createdAt.localeCompare(left.createdAt) ||
    compareText(left.title, right.title)
  );
}

function compareSearchRanks(left: BrowseListPost, right: BrowseListPost): number {
  const leftRank = left.searchMatch?.rank ?? Number.POSITIVE_INFINITY;
  const rightRank = right.searchMatch?.rank ?? Number.POSITIVE_INFINITY;

  if (leftRank === rightRank) {
    return 0;
  }

  return leftRank - rightRank;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}
