import React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { sanitizeTerminalText } from "../formatters.js";
import type { BrowseListPost, BrowseTheme, ChannelStats, ConversationFilterMode, ConversationItem, ConversationSortMode, Notice, ViewMode } from "../types.js";
import { ChannelsView } from "./ChannelsView.js";
import { FooterBar } from "./FooterBar.js";
import { HeaderBar } from "./HeaderBar.js";
import { ListView } from "./ListView.js";
import { PostContextBar } from "./PostContextBar.js";
import { PostView } from "./PostView.js";
import { ReplyComposer } from "./ReplyComposer.js";
import { ShortcutsModal } from "./ShortcutsModal.js";

export function BrowseScreen({
  rootRef,
  onKeyPress,
  theme,
  view,
  channelFilter,
  bundle,
  focusedReplyIndex,
  sortMode,
  autoRefreshEnabled,
  refreshMs,
  posts,
  loading,
  refreshing,
  channelStats,
  rawPosts,
  channelSelectedIndex,
  channelItemRefs,
  selectedIndex,
  listItemRefs,
  now,
  actor,
  conversationItems,
  conversationFilterMode,
  conversationSortMode,
  focusedReplyRefs,
  postScrollRef,
  postContentRef,
  postPanelFocus,
  readProgressLabel,
  replyBody,
  replyInputRef,
  onReplyBodyChange,
  notice,
  selectedConversationIndex,
  showShortcutsHelp,
  shortcutsScrollRef
}: {
  rootRef: React.MutableRefObject<TermElement | null>;
  onKeyPress: (event: { attributes: { key: { name: string; sequence: string; ctrl: boolean; alt: boolean; meta: boolean; shift: boolean } } }) => void;
  theme: BrowseTheme;
  view: ViewMode;
  channelFilter: string;
  bundle: ReadPostBundle | null;
  focusedReplyIndex: number;
  sortMode: "activity" | "recent" | "title" | "channel";
  autoRefreshEnabled: boolean;
  refreshMs: number;
  posts: BrowseListPost[];
  loading: boolean;
  refreshing: boolean;
  channelStats: ChannelStats[];
  rawPosts: BrowseListPost[];
  channelSelectedIndex: number;
  channelItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  selectedIndex: number;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  actor?: string;
  conversationItems: ConversationItem[];
  conversationFilterMode: ConversationFilterMode;
  conversationSortMode: ConversationSortMode;
  focusedReplyRefs: React.MutableRefObject<Array<TermElement | null>>;
  postScrollRef: React.MutableRefObject<TermElement | null>;
  postContentRef: React.MutableRefObject<TermElement | null>;
  postPanelFocus: "index" | "content";
  readProgressLabel: string;
  replyBody: string;
  replyInputRef: React.MutableRefObject<TermInput | null>;
  onReplyBodyChange: (value: string) => void;
  notice: Notice;
  selectedConversationIndex: number;
  showShortcutsHelp: boolean;
  shortcutsScrollRef: React.MutableRefObject<TermElement | null>;
}) {
  return (
    <term:div
      ref={rootRef}
      width="100%"
      height="100%"
      padding={[1, 2]}
      flexDirection="column"
      backgroundColor={theme.bg}
      color={theme.fg}
      focusEvents
      onKeyPress={onKeyPress}
    >
      <HeaderBar
        view={view}
        channelFilter={channelFilter}
        bundle={bundle}
        focusedReplyIndex={focusedReplyIndex}
        sortMode={sortMode}
        autoRefreshEnabled={autoRefreshEnabled}
        refreshMs={refreshMs}
        postsLength={posts.length}
        theme={theme}
        refreshing={refreshing}
      />

      {view === "post" && bundle ? (
        <PostContextBar bundle={bundle} focusedReplyIndex={focusedReplyIndex} actor={actor} now={now} theme={theme} />
      ) : null}

      <term:div
        flexGrow={1}
        flexShrink={1}
        overflow={view === "post" ? undefined : "scroll"}
        padding={[0, 0]}
      >
        {loading ? (
          <term:text color={theme.warning}>{"  Loading threads..."}</term:text>
        ) : view === "channels" ? (
          <ChannelsView
            channelStats={channelStats}
            totalThreads={rawPosts.length}
            selectedIndex={channelSelectedIndex}
            itemRefs={channelItemRefs}
            now={now}
            theme={theme}
          />
        ) : view === "list" ? (
          <ListView posts={posts} selectedIndex={selectedIndex} listItemRefs={listItemRefs} now={now} theme={theme} />
        ) : view === "post" ? (
          <PostView
            bundle={bundle}
            actor={actor}
            now={now}
            theme={theme}
            focusedIndex={focusedReplyIndex}
            conversationItems={conversationItems}
            conversationFilterMode={conversationFilterMode}
            conversationSortMode={conversationSortMode}
            itemRefs={focusedReplyRefs}
            indexScrollRef={postScrollRef}
            contentScrollRef={postContentRef}
            panelFocus={postPanelFocus}
            readProgressLabel={readProgressLabel}
          />
        ) : (
          <ReplyComposer
            bundle={bundle}
            replyBody={replyBody}
            actor={actor}
            inputRef={replyInputRef}
            onReplyBodyChange={onReplyBodyChange}
            theme={theme}
          />
        )}
      </term:div>

      <FooterBar
        notice={notice}
        theme={theme}
        view={view}
        postsLength={posts.length}
        autoRefreshEnabled={autoRefreshEnabled}
        refreshMs={refreshMs}
        selectedIndex={selectedIndex}
        bundleOpen={Boolean(bundle)}
        selectedConversationIndex={selectedConversationIndex}
        conversationItemsLength={conversationItems.length}
      />

      {showShortcutsHelp ? <ShortcutsModal view={view} theme={theme} scrollRef={shortcutsScrollRef} /> : null}
    </term:div>
  );
}
