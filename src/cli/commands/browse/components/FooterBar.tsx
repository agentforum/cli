import React from "react";

import { buildBrowseHint, buildPageLabel, noticeColor, sanitizeTerminalText } from "../formatters.js";
import type { BrowseTheme, Notice, PaginatedItems, ViewMode, BrowseListPost, ConversationItem } from "../types.js";

export function FooterBar({
  notice,
  theme,
  view,
  postsLength,
  postPage,
  autoRefreshEnabled,
  refreshMs,
  selectedIndex,
  bundleOpen,
  selectedConversationIndex,
  conversationItemsLength,
  conversationPage
}: {
  notice: Notice;
  theme: BrowseTheme;
  view: ViewMode;
  postsLength: number;
  postPage: PaginatedItems<BrowseListPost>;
  autoRefreshEnabled: boolean;
  refreshMs: number;
  selectedIndex: number;
  bundleOpen: boolean;
  selectedConversationIndex: number;
  conversationItemsLength: number;
  conversationPage: PaginatedItems<ConversationItem>;
}) {
  return (
    <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginTop={1} flexDirection="row">
      <term:text color={noticeColor(notice) ?? theme.fg}>
        {sanitizeTerminalText(notice?.text ?? buildBrowseHint(view, postsLength))}
      </term:text>
      <term:text color={theme.muted} flexGrow={1} textAlign="right">
        {view === "list"
          ? `${buildPageLabel(postPage.page, postPage.totalPages, postPage.rangeStart, postPage.rangeEnd, postsLength)}  |  ${postsLength > 0 ? `${selectedIndex + 1}/${Math.max(postPage.items.length, 1)}` : "0/0"}  |  `
          : view === "post" && bundleOpen
            ? `${buildPageLabel(
              conversationPage.page,
              conversationPage.totalPages,
              conversationPage.rangeStart,
              conversationPage.rangeEnd,
              conversationItemsLength
            )}  |  ${selectedConversationIndex + 1}/${Math.max(conversationPage.items.length, 1)}  |  `
            : ""}
        {" ? shortcuts  |  t theme  |  a auto  |  Ctrl+C exit"}
      </term:text>
    </term:div>
  );
}
