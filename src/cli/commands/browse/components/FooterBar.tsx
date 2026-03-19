import React from "react";

import { buildBrowseHint, buildPageLabel, describeListDisplayMode, excerpt, noticeColor, sanitizeTerminalText } from "../formatters.js";
import type { BrowseTheme, Notice, PaginatedItems, ViewMode, BrowseListPost, ConversationItem, ListDisplayMode } from "../types.js";

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
  conversationPage,
  listDisplayMode,
  appVersion,
  terminalWidth
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
  listDisplayMode: ListDisplayMode;
  appVersion: string;
  terminalWidth: number;
}) {
  const compact = terminalWidth < 110;
  const leftText = sanitizeTerminalText(notice?.text ?? buildBrowseHint(view, postsLength));
  const rightText = `${
    view === "list"
      ? `${buildPageLabel(postPage.page, postPage.totalPages, postPage.rangeStart, postPage.rangeEnd, postsLength)}  |  ${postsLength > 0 ? `${selectedIndex + 1}/${Math.max(postPage.items.length, 1)}` : "0/0"}  |  `
      : view === "post" && bundleOpen
        ? `${buildPageLabel(
          conversationPage.page,
          conversationPage.totalPages,
          conversationPage.rangeStart,
          conversationPage.rangeEnd,
          conversationItemsLength
        )}  |  ${selectedConversationIndex + 1}/${Math.max(conversationPage.items.length, 1)}  |  `
        : ""
  }v${appVersion}  |  ? shortcuts  |  v ${describeListDisplayMode(listDisplayMode)}  |  t theme  |  a auto  |  Ctrl+C exit`;

  return (
    <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginTop={1} flexDirection="column">
      <term:text color={noticeColor(notice) ?? theme.fg}>
        {excerpt(leftText, compact ? Math.max(24, terminalWidth - 8) : 140)}
      </term:text>
      <term:text color={theme.muted}>
        {excerpt(rightText, compact ? Math.max(24, terminalWidth - 8) : 140)}
      </term:text>
    </term:div>
  );
}
