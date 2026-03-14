import type React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type { PostFilters, PostStatus, PostType, ReadPostBundle, Severity } from "../../../domain/types.js";
import type { PostRecord } from "../../../domain/post.js";
import type { PostService } from "../../../domain/post.service.js";
import type { ReplyService } from "../../../domain/reply.service.js";

export const DEFAULT_REFRESH_MS = 5000;
export const ALL_CHANNELS = "__all__";
export const SORT_MODES = ["activity", "recent", "title", "channel"] as const;
export type BrowseSortMode = (typeof SORT_MODES)[number];
export const CONVERSATION_SORT_MODES = ["thread", "recent"] as const;
export type ConversationSortMode = (typeof CONVERSATION_SORT_MODES)[number];
export const CONVERSATION_FILTER_MODES = ["all", "original", "replies"] as const;
export type ConversationFilterMode = (typeof CONVERSATION_FILTER_MODES)[number];

export interface BrowseOptions {
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

export type ViewMode = "list" | "post" | "reply" | "channels";
export type Notice = { kind: "info" | "error"; text: string } | null;
export type RefreshReason = "initial" | "manual" | "auto" | "reply";
export type PanelFocus = "index" | "content";

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
  selected: string;
  selectedFg: string;
  success: string;
  warning: string;
}

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
  shortcutsScrollRef: React.MutableRefObject<TermElement | null>;
  replyInputRef: React.MutableRefObject<TermInput | null>;
  focusedReplyRefs: React.MutableRefObject<Array<TermElement | null>>;
}

export interface BrowseAppProps {
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

export interface BrowseState {
  view: ViewMode;
  rawPosts: BrowseListPost[];
  selectedIndex: number;
  channelSelectedIndex: number;
  bundle: ReadPostBundle | null;
  replyBody: string;
  loading: boolean;
  refreshing: boolean;
  notice: Notice;
  autoRefreshEnabled: boolean;
  lastRefreshAt: string;
  channelFilter: string;
  sortMode: BrowseSortMode;
  themeIndex: number;
  confirmDelete: BrowseListPost | null;
  focusedReplyIndex: number;
  postPanelFocus: PanelFocus;
  conversationFilterMode: ConversationFilterMode;
  conversationSortMode: ConversationSortMode;
  readProgressLabel: string;
  showShortcutsHelp: boolean;
}
