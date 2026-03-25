import React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type { ReadPostBundle } from "@/domain/post.js";
import type {
  BrowseListPost,
  PostComposerDraft,
  PostComposerField,
  BrowseTheme,
  ChannelStats,
  ConversationFilterMode,
  ConversationItem,
  ConversationSortMode,
  GotoPageMode,
  Notice,
  PaginatedItems,
  ReplyQuote,
  ReplySectionFocus,
  SelectionModalItem,
  SubscriptionComposerDraft,
  SubscriptionComposerField,
  ViewMode,
} from "@/cli/commands/browse/types.js";
import { MAX_SEARCH_QUERY_LENGTH } from "@/cli/commands/browse/search-input.js";
import type {
  SearchBuilderFieldKey,
  SearchBuilderOperator,
  SearchValueSuggestion,
} from "@/cli/search-query.js";
import { ChannelsView } from "./ChannelsView.js";
import { FooterBar } from "./FooterBar.js";
import { GotoPageModal } from "./GotoPageModal.js";
import { HeaderBar } from "./HeaderBar.js";
import { ListView } from "./ListView.js";
import { PostView } from "./PostView.js";
import { ReactionPickerModal } from "./ReactionPickerModal.js";
import { ReaderView } from "./ReaderView.js";
import { ReplyComposer } from "./ReplyComposer.js";
import { SearchBar } from "./SearchBar.js";
import { SelectionModal } from "./SelectionModal.js";
import { ShortcutsModal } from "./ShortcutsModal.js";
import { PostComposer } from "./PostComposer.js";
import { SubscriptionComposer } from "./SubscriptionComposer.js";

const ROOT_VERTICAL_PADDING = 2;
const HEADER_BLOCK_HEIGHT = 6;
const COMPACT_FOOTER_BLOCK_HEIGHT = 6;
const RELAXED_FOOTER_BLOCK_HEIGHT = 5;

export function BrowseScreen({
  rootRef,
  onKeyPress,
  onData,
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
  activeReplyRefs,
  activeReplyRefIndex,
  listDisplayMode,
  readProgressLabel,
  replyBody,
  replyQuotes,
  selectedReplyQuote,
  replySectionFocus,
  replyFocusedQuoteId,
  replyInputRef,
  replyQuotesListRef,
  replyQuotePreviewRef,
  replyQuoteItemRefs,
  onReplyBodyChange,
  postComposerDraft,
  postComposerField,
  postComposerProgress,
  postComposerTextCursorIndex,
  postComposerInputRef,
  postComposerFieldItemRefs,
  onPostComposerFieldChange,
  postComposerRefSuggestionDetails,
  subscriptionComposerDraft,
  subscriptionComposerField,
  subscriptionComposerProgress,
  subscriptionComposerTextCursorIndex,
  subscriptionComposerInputRef,
  subscriptionComposerFieldItemRefs,
  onSubscriptionComposerFieldChange,
  composerPickerTitle,
  composerPickerSubtitle,
  composerPickerItems,
  composerPickerOpen,
  composerPickerQuery,
  composerPickerSelectedIndex,
  composerPickerInputRef,
  onComposerPickerQueryChange,
  searchMode,
  reactionPickerMode,
  reactionPickerSelectedIndex,
  reactionPickerTargetLabel,
  availableReactions,
  searchBuilderActive,
  searchBuilderField,
  searchBuilderOperator,
  searchBuilderValue,
  searchBuilderSelectedValueIndex,
  searchBuilderSegment,
  searchQuery,
  searchMatchQuery,
  activeSearchQuery,
  searchValueSuggestions,
  searchBuilderValueSuggestions,
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
  terminalHeight,
  showMoreAbove,
  showMoreBelow,
  busyOperationKind,
  channelSuggestions,
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
  onData: (event: { attributes: { data: Uint8Array } }) => void;
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
  activeReplyRefs: Array<{
    id: string;
    kind: "post" | "reply";
    label: string;
    author: string;
    replyIndex: number;
  }>;
  activeReplyRefIndex: number;
  listDisplayMode: "compact" | "semantic";
  readProgressLabel: string;
  replyBody: string;
  replyQuotes: ReplyQuote[];
  selectedReplyQuote: ReplyQuote | null;
  replySectionFocus: ReplySectionFocus;
  replyFocusedQuoteId: string | null;
  replyInputRef: React.MutableRefObject<TermInput | null>;
  replyQuotesListRef: React.MutableRefObject<TermElement | null>;
  replyQuotePreviewRef: React.MutableRefObject<TermElement | null>;
  replyQuoteItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  onReplyBodyChange: (value: string) => void;
  postComposerDraft: PostComposerDraft;
  postComposerField: PostComposerField;
  postComposerProgress: string;
  postComposerTextCursorIndex: number;
  postComposerInputRef: React.MutableRefObject<TermInput | null>;
  postComposerFieldItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  onPostComposerFieldChange: (field: PostComposerField, value: string) => void;
  postComposerRefSuggestionDetails: Record<string, string>;
  subscriptionComposerDraft: SubscriptionComposerDraft;
  subscriptionComposerField: SubscriptionComposerField;
  subscriptionComposerProgress: string;
  subscriptionComposerTextCursorIndex: number;
  subscriptionComposerInputRef: React.MutableRefObject<TermInput | null>;
  subscriptionComposerFieldItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  onSubscriptionComposerFieldChange: (field: SubscriptionComposerField, value: string) => void;
  composerPickerTitle: string;
  composerPickerSubtitle: string;
  composerPickerItems: SelectionModalItem[];
  composerPickerOpen: boolean;
  composerPickerQuery: string;
  composerPickerSelectedIndex: number;
  composerPickerInputRef: React.MutableRefObject<TermInput | null>;
  onComposerPickerQueryChange: (value: string) => void;
  searchMode: boolean;
  reactionPickerMode: "post" | "reply" | null;
  reactionPickerSelectedIndex: number;
  reactionPickerTargetLabel: string;
  availableReactions: string[];
  searchBuilderActive: boolean;
  searchBuilderField: SearchBuilderFieldKey;
  searchBuilderOperator: SearchBuilderOperator;
  searchBuilderValue: string;
  searchBuilderSelectedValueIndex: number;
  searchBuilderSegment: "field" | "operator" | "value";
  searchQuery: string;
  searchMatchQuery: string;
  activeSearchQuery: string;
  searchValueSuggestions: SearchValueSuggestion[];
  searchBuilderValueSuggestions: SearchValueSuggestion[];
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
  terminalHeight: number;
  showMoreAbove: boolean;
  showMoreBelow: boolean;
  busyOperationKind: "search" | "refresh" | "submit-post" | "submit-subscription" | null;
  channelSuggestions: string[];
}) {
  const compactFooter = terminalWidth < 120;
  const footerBlockHeight = compactFooter
    ? COMPACT_FOOTER_BLOCK_HEIGHT
    : RELAXED_FOOTER_BLOCK_HEIGHT;
  const mainBodyHeight =
    view === "post" ||
    view === "reply" ||
    view === "compose-post" ||
    view === "compose-subscription"
      ? undefined
      : Math.max(
          3,
          terminalHeight - ROOT_VERTICAL_PADDING - HEADER_BLOCK_HEIGHT - footerBlockHeight
        );

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
      onData={onData}
    >
      <HeaderBar
        view={view}
        channelFilter={channelFilter}
        bundle={bundle}
        focusedReplyIndex={focusedReplyIndex}
        appVersion={appVersion}
        sortMode={sortMode}
        autoRefreshEnabled={autoRefreshEnabled}
        refreshMs={refreshMs}
        autoRefreshCountdownMs={autoRefreshCountdownMs}
        postsLength={postPage.totalCount}
        theme={theme}
        refreshing={refreshing}
        terminalWidth={terminalWidth}
        showMoreAbove={showMoreAbove}
        activeSearchQuery={activeSearchQuery}
      />

      <term:div
        flexGrow={1}
        flexShrink={1}
        height={mainBodyHeight}
        minHeight={0}
        overflow={view === "list" || view === "channels" ? "scroll" : undefined}
        padding={[0, 0]}
      >
        {loading ? (
          <term:div
            border="rounded"
            borderColor={theme.border}
            backgroundColor={theme.surface}
            padding={[1, 2]}
            flexDirection="column"
          >
            <term:text color={theme.warning} fontWeight="bold">
              Loading threads
            </term:text>
            <term:text color={theme.muted}>
              Refreshing the current view and rebuilding the thread list.
            </term:text>
          </term:div>
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
            terminalWidth={terminalWidth}
            searchQuery={searchMatchQuery}
            activeSearchQuery={activeSearchQuery}
            totalCount={postPage.totalCount}
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
            activeReplyRefs={activeReplyRefs}
            activeReplyRefIndex={activeReplyRefIndex}
            readProgressLabel={readProgressLabel}
            terminalWidth={terminalWidth}
            quotedItemIds={new Set(replyQuotes.map((quote) => quote.id))}
            quotedCount={replyQuotes.length}
          />
        ) : view === "reader" ? (
          <ReaderView
            bundle={bundle}
            actor={actor}
            now={now}
            theme={theme}
            focusedIndex={focusedReplyIndex}
            scrollRef={postContentRef}
            readProgressLabel={readProgressLabel}
            activeReplyRefs={activeReplyRefs}
            activeReplyRefIndex={activeReplyRefIndex}
            quotedItemIds={new Set(replyQuotes.map((quote) => quote.id))}
            quotedCount={replyQuotes.length}
          />
        ) : view === "reply" ? (
          <ReplyComposer
            bundle={bundle}
            replyBody={replyBody}
            replyQuotes={replyQuotes}
            selectedReplyQuote={selectedReplyQuote}
            replySectionFocus={replySectionFocus}
            replyFocusedQuoteId={replyFocusedQuoteId}
            actor={actor}
            inputRef={replyInputRef}
            quotesListRef={replyQuotesListRef}
            quotePreviewRef={replyQuotePreviewRef}
            quoteItemRefs={replyQuoteItemRefs}
            onReplyBodyChange={onReplyBodyChange}
            theme={theme}
            terminalWidth={terminalWidth}
            terminalHeight={terminalHeight}
          />
        ) : view === "compose-post" ? (
          <PostComposer
            draft={postComposerDraft}
            focusedField={postComposerField}
            theme={theme}
            refSuggestionDetails={postComposerRefSuggestionDetails}
            textCursorIndex={postComposerTextCursorIndex}
            inputRef={postComposerInputRef}
            fieldItemRefs={postComposerFieldItemRefs}
            onFieldChange={onPostComposerFieldChange}
          />
        ) : (
          <SubscriptionComposer
            draft={subscriptionComposerDraft}
            focusedField={subscriptionComposerField}
            theme={theme}
            textCursorIndex={subscriptionComposerTextCursorIndex}
            inputRef={subscriptionComposerInputRef}
            fieldItemRefs={subscriptionComposerFieldItemRefs}
            onFieldChange={onSubscriptionComposerFieldChange}
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
        terminalWidth={terminalWidth}
        showMoreBelow={showMoreBelow}
        activeSearchQuery={activeSearchQuery}
        busyOperationKind={busyOperationKind}
        composerProgress={
          view === "compose-post"
            ? postComposerProgress
            : view === "compose-subscription"
              ? subscriptionComposerProgress
              : null
        }
      />

      {searchMode ? (
        <SearchBar
          theme={theme}
          value={searchQuery}
          terminalWidth={terminalWidth}
          maxLength={MAX_SEARCH_QUERY_LENGTH}
          valueSuggestions={searchValueSuggestions}
          builderActive={searchBuilderActive}
          builderField={searchBuilderField}
          builderOperator={searchBuilderOperator}
          builderValue={searchBuilderValue}
          builderSelectedValueIndex={searchBuilderSelectedValueIndex}
          builderSegment={searchBuilderSegment}
          builderValueSuggestions={searchBuilderValueSuggestions}
        />
      ) : null}
      {reactionPickerMode ? (
        <ReactionPickerModal
          theme={theme}
          selectedIndex={reactionPickerSelectedIndex}
          targetLabel={reactionPickerTargetLabel}
          reactions={availableReactions}
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
      {composerPickerOpen ? (
        <SelectionModal
          theme={theme}
          title={composerPickerTitle}
          subtitle={composerPickerSubtitle}
          query={composerPickerQuery}
          onQueryChange={onComposerPickerQueryChange}
          items={composerPickerItems}
          selectedIndex={composerPickerSelectedIndex}
        />
      ) : null}
      {showShortcutsHelp ? (
        <ShortcutsModal view={view} theme={theme} scrollRef={shortcutsScrollRef} />
      ) : null}
    </term:div>
  );
}
