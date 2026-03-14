import React from "react";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { breadcrumb, describeRefreshMs, describeSortMode } from "../formatters.js";
import type { BrowseTheme } from "../types.js";

export function HeaderBar({
  view,
  channelFilter,
  bundle,
  focusedReplyIndex,
  sortMode,
  autoRefreshEnabled,
  refreshMs,
  postsLength,
  theme,
  refreshing
}: {
  view: "list" | "post" | "reply" | "channels";
  channelFilter: string;
  bundle: ReadPostBundle | null;
  focusedReplyIndex: number;
  sortMode: "activity" | "recent" | "title" | "channel";
  autoRefreshEnabled: boolean;
  refreshMs: number;
  postsLength: number;
  theme: BrowseTheme;
  refreshing: boolean;
}) {
  return (
    <term:div border="modern" borderColor={theme.muted} padding={[0, 1]} marginBottom={1} flexDirection="row" alignItems="center">
      <term:text color={theme.accent} fontWeight="bold">
        {breadcrumb(view, channelFilter, bundle, focusedReplyIndex)}
      </term:text>
      <term:text color={theme.muted} marginLeft={2}>
        {`${describeSortMode(sortMode)}  |  ${autoRefreshEnabled ? `auto ${describeRefreshMs(refreshMs)}` : "auto off"}  |  ${postsLength} threads  |  ${theme.name}`}
      </term:text>
      {refreshing ? (
        <term:text color={theme.warning} marginLeft={1} fontWeight="bold">
          {"  \u21BB"}
        </term:text>
      ) : null}
    </term:div>
  );
}
