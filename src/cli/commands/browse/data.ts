import type { PostFilters, PostSummaryRecord, ReadPostBundle } from "@/domain/types.js";
import type { PostService } from "@/domain/post.service.js";
import type { ReplyService } from "@/domain/reply.service.js";
import type { SubscriptionService } from "@/domain/subscription.service.js";
import { resolveStructuredSearchFilters } from "@/cli/search-query.js";
import { parseJsonData, parseTagInput } from "@/cli/write-helpers.js";
import { SEVERITIES } from "@/domain/post.js";
import { AgentForumError } from "@/domain/errors.js";
import type {
  BrowseListPost,
  BrowseSortMode,
  PostComposerDraft,
  ReplyQuote,
  SubscriptionComposerDraft,
} from "./types.js";
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

export function buildInitialPostComposerDraft(params: {
  actor?: string;
  session?: string;
  defaultChannel: string;
  channel?: string;
  relatedPostId?: string | null;
  relationType?: string | null;
}): PostComposerDraft {
  return {
    channel: params.channel ?? "",
    type: "finding",
    title: "",
    body: "",
    severity: "",
    data: "",
    tags: "",
    actor: params.actor ?? "",
    session: params.session ?? "",
    relationType: params.relationType ?? "relates-to",
    relatedPostId: params.relatedPostId ?? "",
    blocking: "",
    pinned: "",
    assignedTo: "",
    idempotencyKey: "",
  };
}

export function buildInitialSubscriptionComposerDraft(params: {
  actor?: string;
  defaultChannel: string;
  channel?: string;
}): SubscriptionComposerDraft {
  return {
    mode: "subscribe",
    actor: params.actor ?? "",
    channel: params.channel ?? "",
    tags: "",
  };
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

export async function refreshBrowseData(
  params: RefreshBrowseDataParams
): Promise<RefreshBrowseDataResult> {
  const resolvedSearch = resolveStructuredSearchFilters(params.baseFilters, params.searchQuery);
  const nextBrowsePosts = (
    await params.postService.listPostSummaries({ ...resolvedSearch.filters, limit: undefined })
  ).map((post) => toBrowseListPost(post, resolvedSearch.textQuery));
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
    bundle = await params.postService.getPost(params.currentBundle.post.id);
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

export async function submitBrowseReply(
  replyService: ReplyService,
  params: { postId: string; body: string; actor?: string; quotes?: ReplyQuote[] }
): Promise<void> {
  await replyService.createReply({
    postId: params.postId,
    body: buildReplyBody(params.body, params.quotes),
    data: buildReplyData(params.quotes),
    actor: params.actor,
  });
}

export async function submitBrowsePost(
  postService: PostService,
  draft: PostComposerDraft
): Promise<{ id: string }> {
  const type = draft.type.trim();
  if (!type) {
    throw new AgentForumError(`Invalid type: ${draft.type || "(empty)"}`);
  }

  const severity = draft.severity.trim();
  if (severity && !SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
    throw new AgentForumError(`Invalid severity: ${draft.severity}`);
  }

  const relationType = draft.relationType.trim() || "relates-to";
  const relatedPostId = draft.relatedPostId.trim() || null;
  const useLegacyRef = relatedPostId && relationType === "relates-to";

  const result = await postService.createPost({
    channel: draft.channel.trim(),
    type,
    title: draft.title.trim(),
    body: draft.body,
    severity: severity ? (severity as (typeof SEVERITIES)[number]) : null,
    data: parseJsonData(draft.data.trim() || undefined),
    tags: parseTagInput(draft.tags),
    actor: draft.actor.trim() || null,
    session: draft.session.trim() || null,
    refId: useLegacyRef ? relatedPostId : null,
    blocking: parseBooleanInput(draft.blocking),
    pinned: parseBooleanInput(draft.pinned),
    assignedTo: draft.assignedTo.trim() || null,
    idempotencyKey: draft.idempotencyKey.trim() || null,
  });

  if (relatedPostId && !useLegacyRef) {
    await postService.createRelation({
      fromPostId: result.post.id,
      toPostId: relatedPostId,
      relationType,
      actor: draft.actor.trim() || null,
      session: draft.session.trim() || null,
    });
  }

  return { id: result.post.id };
}

export async function submitBrowseSubscription(
  subscriptionService: SubscriptionService,
  draft: SubscriptionComposerDraft
): Promise<{ removed?: number }> {
  const mode = draft.mode.trim();
  if (mode !== "subscribe" && mode !== "unsubscribe") {
    throw new AgentForumError(`Invalid mode: ${draft.mode || "(empty)"}`);
  }

  if (mode === "unsubscribe") {
    const removed = await subscriptionService.unsubscribe(
      draft.actor.trim(),
      draft.channel.trim(),
      parseTagInput(draft.tags)
    );
    return { removed };
  }

  await subscriptionService.subscribe(
    draft.actor.trim(),
    draft.channel.trim(),
    parseTagInput(draft.tags)
  );
  return {};
}

function parseBooleanInput(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (["true", "yes", "y", "1", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "n", "0", "off"].includes(normalized)) {
    return false;
  }
  throw new AgentForumError(`Invalid boolean value: ${value}`);
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

function buildReplyData(quotes?: ReplyQuote[]): {
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
