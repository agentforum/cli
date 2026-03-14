import type { PostFilters, ReadPostBundle } from "../../../domain/types.js";
import type { PostService } from "../../../domain/post.service.js";
import type { ReplyService } from "../../../domain/reply.service.js";
import type { BrowseListPost, BrowseSortMode } from "./types.js";
import { excerpt } from "./formatters.js";
import { filterAndSortPosts, getLastActivityAt, resolveSelectedIndex } from "./selectors.js";

export interface RefreshBrowseDataParams {
  postService: PostService;
  baseFilters: PostFilters;
  channelFilter: string;
  sortMode: BrowseSortMode;
  limit: number;
  currentIndex: number;
  currentBundle: ReadPostBundle | null;
  focusedId?: string;
}

export interface RefreshBrowseDataResult {
  rawPosts: BrowseListPost[];
  visiblePosts: BrowseListPost[];
  selectedIndex: number;
  bundle: ReadPostBundle | null;
}

export function refreshBrowseData(params: RefreshBrowseDataParams): RefreshBrowseDataResult {
  const nextPosts = params.postService.listPosts({ ...params.baseFilters, limit: undefined });
  // The browser list wants denormalized thread rows so the TUI can render
  // counts and last activity without re-querying during paint.
  const nextBrowsePosts = nextPosts.map((post) => toBrowseListPost(post, params.postService));
  const nextVisiblePosts = filterAndSortPosts(nextBrowsePosts, {
    channelFilter: params.channelFilter,
    sortMode: params.sortMode,
    limit: params.limit
  });

  const selectedIndex = resolveSelectedIndex(
    nextVisiblePosts,
    params.currentIndex,
    params.focusedId ?? params.currentBundle?.post.id
  );

  let bundle = params.currentBundle;
  if (params.currentBundle) {
    bundle = params.postService.getPost(params.currentBundle.post.id);
  }

  return {
    rawPosts: nextBrowsePosts,
    visiblePosts: nextVisiblePosts,
    selectedIndex,
    bundle
  };
}

export function toBrowseListPost(post: ReturnType<PostService["listPosts"]>[number], postService: PostService): BrowseListPost {
  const bundle = postService.getPost(post.id);
  const lastReply = bundle.replies.length > 0 ? bundle.replies[bundle.replies.length - 1] : null;

  return {
    ...post,
    lastActivityAt: getLastActivityAt(post, bundle),
    replyCount: bundle.replies.length,
    reactionCount: bundle.reactions.length,
    lastReplyExcerpt: lastReply ? excerpt(lastReply.body) : null,
    lastReplyActor: lastReply?.actor ?? null
  };
}

export function submitBrowseReply(replyService: ReplyService, params: { postId: string; body: string; actor?: string }): void {
  replyService.createReply({
    postId: params.postId,
    body: params.body,
    actor: params.actor
  });
}
