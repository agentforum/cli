import type React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type { SearchBuilderFieldKey, SearchBuilderOperator } from "@/cli/search-query.js";
import type {
  PostFilters,
  PostStatus,
  PostType,
  PostRelationRecord,
  ReadPostBundle,
  Severity,
} from "@/domain/types.js";
import type { ReplyQuoteRef } from "@/domain/reply.js";
import type { PostRecord, SearchMatchRecord } from "@/domain/post.js";
import type { PostService } from "@/domain/post.service.js";
import type { ReplyService } from "@/domain/reply.service.js";
import type { SubscriptionService } from "@/domain/subscription.service.js";
import type { PresetRecord } from "@/domain/preset.js";
import type { RelationCatalogEntry } from "@/domain/relation.js";

export const DEFAULT_REFRESH_MS = 5000;
export const DEFAULT_REPLY_PAGE_SIZE = 20;
export const ALL_CHANNELS = "__all__";
export const LIST_DISPLAY_MODES = ["compact", "semantic"] as const;
export type ListDisplayMode = (typeof LIST_DISPLAY_MODES)[number];
export const SORT_MODES = ["activity", "recent", "title", "channel"] as const;
export type BrowseSortMode = (typeof SORT_MODES)[number];
export const CONVERSATION_SORT_MODES = ["thread", "recent"] as const;
export type ConversationSortMode = (typeof CONVERSATION_SORT_MODES)[number];
export const CONVERSATION_FILTER_MODES = ["all", "original", "replies"] as const;
export type ConversationFilterMode = (typeof CONVERSATION_FILTER_MODES)[number];
export const POST_COMPOSER_FIELDS = [
  "channel",
  "type",
  "title",
  "body",
  "severity",
  "data",
  "tags",
  "actor",
  "session",
  "relationType",
  "relatedPostId",
  "blocking",
  "pinned",
  "assignedTo",
  "idempotencyKey",
] as const;
export type PostComposerField = (typeof POST_COMPOSER_FIELDS)[number];
export const SUBSCRIPTION_COMPOSER_FIELDS = ["mode", "actor", "channel", "tags"] as const;
export type SubscriptionComposerField = (typeof SUBSCRIPTION_COMPOSER_FIELDS)[number];

export interface BrowseOptions {
  id?: string;
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  text?: string;
  pinned?: boolean;
  limit?: string;
  actor?: string;
  session?: string;
  unreadFor?: string;
  subscribedFor?: string;
  assignedTo?: string;
  waitingFor?: string;
  autoRefresh?: boolean;
  refreshMs?: string;
}

export type ViewMode =
  | "list"
  | "post"
  | "reader"
  | "reply"
  | "channels"
  | "compose-post"
  | "compose-subscription";
export type Notice = { kind: "info" | "error"; text: string } | null;
export type RefreshReason = "initial" | "manual" | "auto" | "reply" | "post";
export type PanelFocus = "index" | "content";
export type GotoPageMode = "list" | "thread";
export type ReplySectionFocus = "quotes" | "preview" | "editor";
export type ReactionPickerMode = "post" | "reply" | null;
export type SubscribeMode = "subscribe" | "unsubscribe";
export type ConfirmDiscardTarget = "reply" | "compose-post" | "compose-subscription" | null;
export type ComposerPickerTarget =
  | { composer: "post"; field: PostComposerField }
  | { composer: "subscription"; field: SubscriptionComposerField };

export interface SelectionModalItem {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
  synthetic?: boolean;
}

export interface PostComposerDraft {
  channel: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  data: string;
  tags: string;
  actor: string;
  session: string;
  relationType: string;
  relatedPostId: string;
  blocking: string;
  pinned: string;
  assignedTo: string;
  idempotencyKey: string;
}

export interface SubscriptionComposerDraft {
  mode: string;
  actor: string;
  channel: string;
  tags: string;
}

export type ComposerFieldKind = "text" | "multiline" | "enum";

export function getVisiblePostComposerFields(draft: PostComposerDraft): PostComposerField[] {
  return [
    "channel",
    "type",
    "title",
    "body",
    "severity",
    "data",
    "tags",
    "actor",
    "session",
    "relationType",
    "relatedPostId",
    "blocking",
    "pinned",
    "assignedTo",
    "idempotencyKey",
  ];
}

export function getPostComposerFieldKind(field: PostComposerField): ComposerFieldKind {
  switch (field) {
    case "body":
    case "data":
      return "multiline";
    case "severity":
    case "relationType":
    case "blocking":
    case "pinned":
      return "enum";
    default:
      return "text";
  }
}

export function getSubscriptionComposerFieldKind(
  field: SubscriptionComposerField
): ComposerFieldKind {
  return field === "mode" ? "enum" : "text";
}

export type KeyLike = {
  name: string;
  sequence: string;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  shift: boolean;
};

export interface BrowseTheme {
  name: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  banner: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  borderStrong: string;
  focus: string;
  selected: string;
  selectedFg: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  statusOpen: string;
  statusAnswered: string;
  statusNeedsClarification: string;
  statusWontAnswer: string;
  statusStale: string;
}

export interface BrowseListPost extends PostRecord {
  lastActivityAt: string;
  replyCount: number;
  reactionCount: number;
  lastReplyExcerpt: string | null;
  lastReplyActor: string | null;
  searchMatch: SearchMatchRecord | null;
}

export interface BrowseRelationSummary {
  relationId: string;
  relationType: string;
  otherPostId: string;
  direction: "incoming" | "outgoing";
  label: string;
  description?: string;
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
  quoteRefs: ReplyQuoteRef[];
}

export interface ReplyQuote {
  id: string;
  kind: "post" | "reply";
  label: string;
  text: string;
  author: string;
  replyIndex: number;
}

export interface PaginatedItems<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  page: number;
  offset: number;
  rangeStart: number;
  rangeEnd: number;
}

export interface ChannelStats {
  name: string;
  threadCount: number;
  lastActivityAt: string;
}

export interface BrowseRefs {
  rootRef: React.MutableRefObject<TermElement | null>;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  channelItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  postScrollRef: React.MutableRefObject<TermElement | null>;
  postContentRef: React.MutableRefObject<TermElement | null>;
  readerScrollRef: React.MutableRefObject<TermElement | null>;
  shortcutsScrollRef: React.MutableRefObject<TermElement | null>;
  replyInputRef: React.MutableRefObject<TermInput | null>;
  replyQuotesListRef: React.MutableRefObject<TermElement | null>;
  replyQuotePreviewRef: React.MutableRefObject<TermElement | null>;
  focusedReplyRefs: React.MutableRefObject<Array<TermElement | null>>;
}

export interface BrowseAppProps {
  postService: PostService;
  replyService: ReplyService;
  subscriptionService: SubscriptionService;
  availableReactions: string[];
  availableRelationTypes: string[];
  availableRelationCatalog: RelationCatalogEntry[];
  preset: PresetRecord;
  baseFilters: PostFilters;
  initialChannelFilter: string;
  limit: number;
  actor?: string;
  session?: string;
  refreshMs: number;
  initialAutoRefresh: boolean;
  initialPostId?: string;
  initialSearchQuery?: string;
  defaultChannel: string;
}

export interface BrowseState {
  view: ViewMode;
  rawPosts: BrowseListPost[];
  selectedIndex: number;
  listOffset: number;
  channelSelectedIndex: number;
  bundle: ReadPostBundle | null;
  replyBody: string;
  replyQuotes: ReplyQuote[];
  replyFocusedQuoteId: string | null;
  replySectionFocus: ReplySectionFocus;
  activeReplyRefIndex: number;
  loading: boolean;
  refreshing: boolean;
  notice: Notice;
  autoRefreshEnabled: boolean;
  lastRefreshAt: string;
  channelFilter: string;
  listDisplayMode: ListDisplayMode;
  sortMode: BrowseSortMode;
  themeIndex: number;
  confirmDelete: BrowseListPost | null;
  confirmQuit: boolean;
  confirmDiscardTarget: ConfirmDiscardTarget;
  focusedReplyIndex: number;
  postPanelFocus: PanelFocus;
  readerMode: boolean;
  conversationFilterMode: ConversationFilterMode;
  conversationSortMode: ConversationSortMode;
  replyPage: number;
  replyPageSize: number;
  readProgressLabel: string;
  showShortcutsHelp: boolean;
  gotoPageMode: GotoPageMode | null;
  gotoPageInput: string;
  searchMode: boolean;
  reactionPickerMode: ReactionPickerMode;
  reactionPickerSelectedIndex: number;
  postComposerDraft: PostComposerDraft;
  postComposerField: PostComposerField;
  subscriptionComposerDraft: SubscriptionComposerDraft;
  subscriptionComposerField: SubscriptionComposerField;
  composerPickerTarget: ComposerPickerTarget | null;
  composerPickerQuery: string;
  composerPickerSelectedIndex: number;
  composerPickerPristine: boolean;
  searchBuilderActive: boolean;
  searchBuilderField: SearchBuilderFieldKey;
  searchBuilderOperator: SearchBuilderOperator;
  searchBuilderValue: string;
  searchBuilderSelectedValueIndex: number;
  searchBuilderSegment: "field" | "operator" | "value";
  searchQuery: string;
  searchDraftQuery: string;
  busyOperationKind: "search" | "refresh" | "submit-post" | "submit-subscription" | null;
  changedPostIds: string[];
}
