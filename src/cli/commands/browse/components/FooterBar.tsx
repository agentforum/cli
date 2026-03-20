import React from "react";

import {
  buildBrowseHint,
  buildPageLabel,
  describeListDisplayMode,
  excerpt,
  noticeColor,
  sanitizeTerminalText,
} from "@/cli/commands/browse/formatters.js";
import type {
  BrowseTheme,
  Notice,
  PaginatedItems,
  ViewMode,
  BrowseListPost,
  ConversationItem,
  ListDisplayMode,
} from "@/cli/commands/browse/types.js";

export function FooterBar({
  notice,
  theme,
  view,
  postsLength,
  postPage,
  autoRefreshEnabled: _autoRefreshEnabled,
  refreshMs: _refreshMs,
  selectedIndex,
  bundleOpen,
  selectedConversationIndex,
  conversationItemsLength,
  conversationPage,
  listDisplayMode,
  appVersion,
  terminalWidth,
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
  const statusText = `${
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
  }v${appVersion}  |  view ${describeListDisplayMode(listDisplayMode)}`;
  const commandText = "? shortcuts  |  t theme  |  a auto  |  Ctrl+C exit";

  return (
    <term:div
      border="rounded"
      borderColor={theme.border}
      backgroundColor={theme.surface}
      padding={[0, 1]}
      marginTop={1}
      flexDirection="column"
    >
      <term:text color={noticeColor(notice) ?? theme.fg} fontWeight={notice ? "bold" : undefined}>
        {excerpt(leftText, compact ? Math.max(24, terminalWidth - 8) : 140)}
      </term:text>
      <term:text color={theme.muted}>
        {excerpt(statusText, compact ? Math.max(24, terminalWidth - 8) : 140)}
      </term:text>
      <term:text color={theme.muted}>
        {excerpt(commandText, compact ? Math.max(24, terminalWidth - 8) : 140)}
      </term:text>
    </term:div>
  );
}
