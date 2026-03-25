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
  terminalWidth,
  showMoreBelow,
  activeSearchQuery,
  busyOperationKind,
  composerProgress,
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
  terminalWidth: number;
  showMoreBelow: boolean;
  activeSearchQuery: string;
  busyOperationKind: "search" | "refresh" | "submit-post" | "submit-subscription" | null;
  composerProgress?: string | null;
}) {
  const compact = terminalWidth < 110;
  const relaxed = terminalWidth >= 120;
  const leftText = sanitizeTerminalText(
    notice?.text ??
      (busyOperationKind === "search"
        ? `Searching ${activeSearchQuery || "threads"}  |  Esc cancel`
        : busyOperationKind === "submit-post"
          ? "Creating post..."
          : busyOperationKind === "submit-subscription"
            ? "Saving channel subscription..."
            : activeSearchQuery && view === "list"
              ? `Search active: ${activeSearchQuery}`
              : buildBrowseHint(view, postsLength))
  );
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
        : (view === "compose-post" || view === "compose-subscription") && composerProgress
          ? `${composerProgress}  |  `
          : ""
  }view ${describeListDisplayMode(listDisplayMode)}`;
  const commandText =
    view === "compose-post"
      ? "Tab/Shift+Tab fields  |  Enter picker  |  ←/→ options  |  Ctrl+S create  |  Esc back"
      : view === "compose-subscription"
        ? "Tab/Shift+Tab fields  |  Enter picker  |  ←/→ options  |  Ctrl+S save  |  Esc back"
        : "? help  |  t theme  |  a auto  |  Ctrl+C exit";

  return (
    <term:div
      border="rounded"
      borderColor={theme.border}
      backgroundColor={theme.surface}
      padding={[0, 1]}
      marginTop={1}
      flexDirection="column"
      flexShrink={0}
    >
      <term:text
        color={noticeColor(notice, theme) ?? theme.fg}
        fontWeight={notice ? "bold" : undefined}
      >
        {excerpt(leftText, compact ? Math.max(24, terminalWidth - 8) : 140)}
      </term:text>
      {relaxed ? (
        <term:div flexDirection="row">
          <term:text color={theme.muted}>
            {excerpt(statusText, Math.max(28, terminalWidth - 44))}
          </term:text>
          <term:text flexGrow={1} />
          <term:text color={theme.muted}>{excerpt(commandText, 48)}</term:text>
          {showMoreBelow ? (
            <term:text color={theme.muted} textAlign="right" whiteSpace="pre">
              {"  ↓ more"}
            </term:text>
          ) : null}
        </term:div>
      ) : (
        <>
          <term:text color={theme.muted}>
            {excerpt(statusText, compact ? Math.max(24, terminalWidth - 8) : 140)}
          </term:text>
          <term:div flexDirection="row">
            <term:text color={theme.muted}>
              {excerpt(commandText, compact ? Math.max(24, terminalWidth - 18) : 120)}
            </term:text>
            <term:text flexGrow={1} />
            {showMoreBelow ? (
              <term:text color={theme.muted} textAlign="right">
                {"↓ more"}
              </term:text>
            ) : null}
          </term:div>
        </>
      )}
    </term:div>
  );
}
