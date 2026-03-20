import type { PostFilters, PostSummaryRecord, ReadPostBundle } from "@/domain/types.js";
import type { PostService } from "@/domain/post.service.js";
import type { ReplyService } from "@/domain/reply.service.js";
import type { BrowseListPost, BrowseSortMode, ReplyQuote } from "./types.js";
import { excerpt } from "./formatters.js";
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
  const nextBrowsePosts = params.postService
    .listPostSummaries({
      ...params.baseFilters,
      text: params.searchQuery?.trim() || undefined,
      limit: undefined,
    })
    .map(toBrowseListPost);
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
  };
}

export function submitBrowseReply(
  replyService: ReplyService,
  params: { postId: string; body: string; actor?: string; quote?: ReplyQuote | null }
): void {
  replyService.createReply({
    postId: params.postId,
    body: buildReplyBody(params.body, params.quote),
    actor: params.actor,
  });
}

function buildReplyBody(body: string, quote?: ReplyQuote | null): string {
  if (!quote) {
    return body;
  }

  const quotedLines = quote.text
    .trim()
    .split("\n")
    .slice(0, 6)
    .map((line) => `> ${line}`)
    .join("\n");

  return [`> [@${quote.author} · reply #${quote.replyIndex + 1}]`, quotedLines, "", body].join(
    "\n"
  );
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
