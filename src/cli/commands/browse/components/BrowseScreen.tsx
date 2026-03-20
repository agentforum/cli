import React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { sanitizeTerminalText } from "../formatters.js";
import type {
  BrowseListPost,
  BrowseTheme,
  ChannelStats,
  ConversationFilterMode,
  ConversationItem,
  ConversationSortMode,
  GotoPageMode,
  Notice,
  PaginatedItems,
  ReplyQuote,
  ViewMode,
} from "../types.js";
import { ChannelsView } from "./ChannelsView.js";
import { FooterBar } from "./FooterBar.js";
import { GotoPageModal } from "./GotoPageModal.js";
import { HeaderBar } from "./HeaderBar.js";
import { ListView } from "./ListView.js";
import { PostContextBar } from "./PostContextBar.js";
import { PostView } from "./PostView.js";
import { ReplyComposer } from "./ReplyComposer.js";
import { SearchBar } from "./SearchBar.js";
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
  autoRefreshCountdownMs,
  posts,
  postPage,
  loading,
  refreshing,
  channelStats,
  rawPosts,
  changedPostIds,
  channelSelectedIndex,
  channelItemRefs,
  selectedIndex,
  listItemRefs,
  now,
  actor,
  conversationItems,
  conversationPage,
  conversationFilterMode,
  conversationSortMode,
  focusedReplyRefs,
  postScrollRef,
  postContentRef,
  postPanelFocus,
  listDisplayMode,
  readProgressLabel,
  replyBody,
  replyQuote,
  replyInputRef,
  onReplyBodyChange,
  searchMode,
  searchQuery,
  searchInputRef,
  onSearchQueryChange,
  gotoPageMode,
  gotoPageInput,
  gotoPageInputRef,
  onGotoPageInputChange,
  notice,
  selectedConversationIndex,
  showShortcutsHelp,
  shortcutsScrollRef,
  appVersion,
  terminalWidth,
}: {
  rootRef: React.MutableRefObject<TermElement | null>;
  onKeyPress: (event: {
    attributes: {
      key: {
        name: string;
        sequence: string;
        ctrl: boolean;
        alt: boolean;
        meta: boolean;
        shift: boolean;
      };
    };
  }) => void;
  theme: BrowseTheme;
  view: ViewMode;
  channelFilter: string;
  bundle: ReadPostBundle | null;
  focusedReplyIndex: number;
  sortMode: "activity" | "recent" | "title" | "channel";
  autoRefreshEnabled: boolean;
  refreshMs: number;
  autoRefreshCountdownMs?: number | null;
  posts: BrowseListPost[];
  postPage: PaginatedItems<BrowseListPost>;
  loading: boolean;
  refreshing: boolean;
  channelStats: ChannelStats[];
  rawPosts: BrowseListPost[];
  changedPostIds: string[];
  channelSelectedIndex: number;
  channelItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  selectedIndex: number;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  actor?: string;
  conversationItems: ConversationItem[];
  conversationPage: PaginatedItems<ConversationItem>;
  conversationFilterMode: ConversationFilterMode;
  conversationSortMode: ConversationSortMode;
  focusedReplyRefs: React.MutableRefObject<Array<TermElement | null>>;
  postScrollRef: React.MutableRefObject<TermElement | null>;
  postContentRef: React.MutableRefObject<TermElement | null>;
  postPanelFocus: "index" | "content";
  listDisplayMode: "compact" | "semantic";
  readProgressLabel: string;
  replyBody: string;
  replyQuote: ReplyQuote | null;
  replyInputRef: React.MutableRefObject<TermInput | null>;
  onReplyBodyChange: (value: string) => void;
  searchMode: boolean;
  searchQuery: string;
  searchInputRef: React.MutableRefObject<TermInput | null>;
  onSearchQueryChange: (value: string) => void;
  gotoPageMode: GotoPageMode | null;
  gotoPageInput: string;
  gotoPageInputRef: React.MutableRefObject<TermInput | null>;
  onGotoPageInputChange: (value: string) => void;
  notice: Notice;
  selectedConversationIndex: number;
  showShortcutsHelp: boolean;
  shortcutsScrollRef: React.MutableRefObject<TermElement | null>;
  appVersion: string;
  terminalWidth: number;
}) {
  return (
    <term:div
      ref={rootRef}
      width="100%"
      height="100%"
      padding={[1, 1]}
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
        autoRefreshCountdownMs={autoRefreshCountdownMs}
        postsLength={postPage.totalCount}
        theme={theme}
        refreshing={refreshing}
        terminalWidth={terminalWidth}
      />

      {view === "post" && bundle ? (
        <PostContextBar
          bundle={bundle}
          focusedReplyIndex={focusedReplyIndex}
          actor={actor}
          now={now}
          theme={theme}
        />
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
          <ListView
            posts={posts}
            changedPostIds={changedPostIds}
            selectedIndex={selectedIndex}
            listItemRefs={listItemRefs}
            now={now}
            theme={theme}
            displayMode={listDisplayMode}
          />
        ) : view === "post" ? (
          <PostView
            bundle={bundle}
            actor={actor}
            now={now}
            theme={theme}
            focusedIndex={focusedReplyIndex}
            conversationItems={conversationItems}
            conversationPage={conversationPage}
            conversationFilterMode={conversationFilterMode}
            conversationSortMode={conversationSortMode}
            itemRefs={focusedReplyRefs}
            indexScrollRef={postScrollRef}
            contentScrollRef={postContentRef}
            panelFocus={postPanelFocus}
            readProgressLabel={readProgressLabel}
            terminalWidth={terminalWidth}
          />
        ) : (
          <ReplyComposer
            bundle={bundle}
            replyBody={replyBody}
            replyQuote={replyQuote}
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
        postsLength={postPage.totalCount}
        postPage={postPage}
        autoRefreshEnabled={autoRefreshEnabled}
        refreshMs={refreshMs}
        selectedIndex={selectedIndex}
        bundleOpen={Boolean(bundle)}
        selectedConversationIndex={selectedConversationIndex}
        conversationItemsLength={conversationPage.totalCount}
        conversationPage={conversationPage}
        listDisplayMode={listDisplayMode}
        appVersion={appVersion}
        terminalWidth={terminalWidth}
      />

      {searchMode ? (
        <SearchBar
          theme={theme}
          inputRef={searchInputRef}
          value={searchQuery}
          onChange={onSearchQueryChange}
        />
      ) : null}
      {gotoPageMode ? (
        <GotoPageModal
          theme={theme}
          mode={gotoPageMode}
          totalPages={gotoPageMode === "list" ? postPage.totalPages : conversationPage.totalPages}
          inputRef={gotoPageInputRef}
          value={gotoPageInput}
          onChange={onGotoPageInputChange}
        />
      ) : null}
      {showShortcutsHelp ? (
        <ShortcutsModal view={view} theme={theme} scrollRef={shortcutsScrollRef} />
      ) : null}
    </term:div>
  );
}
