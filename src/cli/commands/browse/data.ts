import type { PostFilters, PostSummaryRecord, ReadPostBundle } from "@/domain/types.js";
import type { PostService } from "@/domain/post.service.js";
import type { ReplyService } from "@/domain/reply.service.js";
import { resolveStructuredSearchFilters } from "@/cli/search-query.js";
import type { BrowseListPost, BrowseSortMode, ReplyQuote } from "./types.js";
import { excerpt, sanitizeTerminalText } from "./formatters.js";
import {
  filterAndSortPosts,
  paginateItems,
  resolvePageOffsetForId,
  resolveSelectedIndex,
} from "./selectors.js";

export interface RefreshBrowseDataParams {
  postService: PostService;
  baseFilters: PostFilters;
  channelFilter: string;
  sortMode: BrowseSortMode;
  limit: number;
  currentOffset: number;
  currentIndex: number;
  currentRawPosts: BrowseListPost[];
  currentBundle: ReadPostBundle | null;
  searchQuery?: string;
  focusedId?: string;
}

export interface RefreshBrowseDataResult {
  rawPosts: BrowseListPost[];
  visiblePosts: BrowseListPost[];
  totalVisibleCount: number;
  listOffset: number;
  selectedIndex: number;
  bundle: ReadPostBundle | null;
  changedPostIds: string[];
}

export function refreshBrowseData(params: RefreshBrowseDataParams): RefreshBrowseDataResult {
  const resolvedSearch = resolveStructuredSearchFilters(params.baseFilters, params.searchQuery);
  const nextBrowsePosts = params.postService
    .listPostSummaries({ ...resolvedSearch.filters, limit: undefined })
    .map((post) => toBrowseListPost(post, resolvedSearch.textQuery));
  const sortedPosts = filterAndSortPosts(nextBrowsePosts, {
    channelFilter: params.channelFilter,
    sortMode: params.sortMode,
    limit: Math.max(nextBrowsePosts.length, 1),
    offset: 0,
  }).items;
  const pageOffset = resolvePageOffsetForId(sortedPosts, {
    currentOffset: params.currentOffset,
    limit: params.limit,
    focusedId: params.focusedId ?? params.currentBundle?.post.id,
  });
  const nextVisible = paginateItems(sortedPosts, { limit: params.limit, offset: pageOffset });

  const selectedIndex = resolveSelectedIndex(
    nextVisible.items,
    params.currentIndex,
    params.focusedId ?? params.currentBundle?.post.id
  );

  let bundle = params.currentBundle;
  if (params.currentBundle) {
    bundle = params.postService.getPost(params.currentBundle.post.id);
  }

  return {
    rawPosts: nextBrowsePosts,
    visiblePosts: nextVisible.items,
    totalVisibleCount: nextVisible.totalCount,
    listOffset: nextVisible.offset,
    selectedIndex,
    bundle,
    changedPostIds: collectChangedPostIds(params.currentRawPosts, nextBrowsePosts),
  };
}

export function toBrowseListPost(post: PostSummaryRecord): BrowseListPost {
  return {
    ...post,
    lastReplyExcerpt: post.lastReplyExcerpt ? excerpt(post.lastReplyExcerpt) : null,
    searchMatch: post.searchMatch
      ? {
          ...post.searchMatch,
          excerpt: sanitizeTerminalText(post.searchMatch.excerpt),
          kinds: [...post.searchMatch.kinds],
        }
      : null,
  };
}

export function submitBrowseReply(
  replyService: ReplyService,
  params: { postId: string; body: string; actor?: string; quotes?: ReplyQuote[] }
): void {
  replyService.createReply({
    postId: params.postId,
    body: buildReplyBody(params.body, params.quotes),
    data: buildReplyData(params.quotes),
    actor: params.actor,
  });
}

function buildReplyBody(body: string, quotes?: ReplyQuote[]): string {
  if (!quotes || quotes.length === 0) {
    return body;
  }

  const blocks = [...quotes]
    .sort((left, right) => left.replyIndex - right.replyIndex)
    .map((quote) => {
      const quotedLines = quote.text
        .trim()
        .split("\n")
        .slice(0, 6)
        .map((line) => `> ${line}`)
        .join("\n");

      return [
        `> [@${quote.author} · ${quote.label.toLowerCase()} · ref ${quote.id}]`,
        quotedLines,
      ].join("\n");
    });

  return [...blocks, "", body].join("\n\n");
}

function buildReplyData(
  quotes?: ReplyQuote[]
): {
  quoteRefs: Array<{
    id: string;
    kind: "post" | "reply";
    label: string;
    author: string;
    replyIndex: number;
  }>;
} | null {
  if (!quotes || quotes.length === 0) {
    return null;
  }

  return {
    quoteRefs: [...quotes]
      .sort((left, right) => left.replyIndex - right.replyIndex)
      .map((quote) => ({
        id: quote.id,
        kind: quote.kind,
        label: quote.label,
        author: quote.author,
        replyIndex: quote.replyIndex,
      })),
  };
}

function collectChangedPostIds(
  currentRawPosts: BrowseListPost[],
  nextBrowsePosts: BrowseListPost[]
): string[] {
  if (currentRawPosts.length === 0) {
    return [];
  }

  const previousById = new Map(currentRawPosts.map((post) => [post.id, post]));
  return nextBrowsePosts
    .filter((post) => {
      const previous = previousById.get(post.id);
      return (
        !previous ||
        previous.lastActivityAt !== post.lastActivityAt ||
        previous.replyCount !== post.replyCount
      );
    })
    .map((post) => post.id);
}
