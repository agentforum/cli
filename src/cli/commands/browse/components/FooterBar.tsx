import React from "react";

import { buildBrowseHint, noticeColor, sanitizeTerminalText } from "../formatters.js";
import type { BrowseTheme, Notice, ViewMode } from "../types.js";

export function FooterBar({
  notice,
  theme,
  view,
  postsLength,
  autoRefreshEnabled,
  refreshMs,
  selectedIndex,
  bundleOpen,
  selectedConversationIndex,
  conversationItemsLength
}: {
  notice: Notice;
  theme: BrowseTheme;
  view: ViewMode;
  postsLength: number;
  autoRefreshEnabled: boolean;
  refreshMs: number;
  selectedIndex: number;
  bundleOpen: boolean;
  selectedConversationIndex: number;
  conversationItemsLength: number;
}) {
  return (
    <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginTop={1} flexDirection="row">
      <term:text color={noticeColor(notice) ?? theme.fg}>
        {sanitizeTerminalText(notice?.text ?? buildBrowseHint(view, postsLength))}
      </term:text>
      <term:text color={theme.muted} flexGrow={1} textAlign="right">
        {view === "list" && postsLength > 0
          ? `${selectedIndex + 1}/${postsLength}  |  `
          : view === "post" && bundleOpen
            ? `${selectedConversationIndex + 1}/${Math.max(conversationItemsLength, 1)}  |  `
            : ""}
        {" ? shortcuts  |  t theme  |  a auto  |  Ctrl+C exit"}
      </term:text>
    </term:div>
  );
}
