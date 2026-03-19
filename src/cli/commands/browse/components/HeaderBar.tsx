import React from "react";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { breadcrumb, buildAutoRefreshLabel, describeSortMode, excerpt } from "../formatters.js";
import type { BrowseTheme } from "../types.js";

export function HeaderBar({
  view,
  channelFilter,
  bundle,
  focusedReplyIndex,
  sortMode,
  autoRefreshEnabled,
  refreshMs,
  autoRefreshCountdownMs,
  postsLength,
  theme,
  refreshing,
  terminalWidth
}: {
  view: "list" | "post" | "reply" | "channels";
  channelFilter: string;
  bundle: ReadPostBundle | null;
  focusedReplyIndex: number;
  sortMode: "activity" | "recent" | "title" | "channel";
  autoRefreshEnabled: boolean;
  refreshMs: number;
  autoRefreshCountdownMs?: number | null;
  postsLength: number;
  theme: BrowseTheme;
  refreshing: boolean;
  terminalWidth: number;
}) {
  const compact = terminalWidth < 110;
  const breadcrumbText = excerpt(breadcrumb(view, channelFilter, bundle, focusedReplyIndex), compact ? Math.max(24, terminalWidth - 8) : 100);
  const detailText = excerpt(
    `${describeSortMode(sortMode)}  |  ${refreshing ? "refreshing..." : buildAutoRefreshLabel(autoRefreshEnabled, refreshMs, autoRefreshCountdownMs)}  |  ${postsLength} threads  |  ${theme.name}`,
    compact ? Math.max(24, terminalWidth - 8) : 120
  );

  return (
    <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginBottom={1} flexDirection="column">
      <term:div flexDirection="row" alignItems="center">
        <term:text color={theme.accent} fontWeight="bold">
          {breadcrumbText}
        </term:text>
        {refreshing ? (
          <term:text color={theme.warning} marginLeft={1} fontWeight="bold">
            {"  \u21BB"}
          </term:text>
        ) : null}
      </term:div>
      <term:text color={theme.muted}>
        {detailText}
      </term:text>
    </term:div>
  );
}
