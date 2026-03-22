import React from "react";

import type { ReadPostBundle } from "@/domain/post.js";
import {
  breadcrumb,
  buildAutoRefreshLabel,
  describeSortMode,
  excerpt,
} from "@/cli/commands/browse/formatters.js";
import type { BrowseTheme } from "@/cli/commands/browse/types.js";

export function HeaderBar({
  view,
  channelFilter,
  bundle,
  focusedReplyIndex,
  appVersion,
  sortMode,
  autoRefreshEnabled,
  refreshMs,
  autoRefreshCountdownMs,
  postsLength,
  theme,
  refreshing,
  terminalWidth,
  showMoreAbove,
  activeSearchQuery,
}: {
  view: "list" | "post" | "reader" | "reply" | "channels";
  channelFilter: string;
  bundle: ReadPostBundle | null;
  focusedReplyIndex: number;
  appVersion: string;
  sortMode: "activity" | "recent" | "title" | "channel";
  autoRefreshEnabled: boolean;
  refreshMs: number;
  autoRefreshCountdownMs?: number | null;
  postsLength: number;
  theme: BrowseTheme;
  refreshing: boolean;
  terminalWidth: number;
  showMoreAbove: boolean;
  activeSearchQuery: string;
}) {
  const compact = terminalWidth < 110;
  const breadcrumbText = excerpt(
    breadcrumb(view, channelFilter, bundle, focusedReplyIndex),
    compact ? Math.max(24, terminalWidth - 8) : 100
  );
  const detailText = excerpt(
    `${activeSearchQuery ? `search ${activeSearchQuery}  |  ` : ""}${describeSortMode(sortMode)}  |  ${refreshing ? "refreshing..." : buildAutoRefreshLabel(autoRefreshEnabled, refreshMs, autoRefreshCountdownMs)}  |  ${postsLength} threads  |  ${theme.name}`,
    compact ? Math.max(24, terminalWidth - 8) : 120
  );

  return (
    <term:div
      border="rounded"
      borderColor={theme.border}
      backgroundColor={theme.surface}
      padding={[0, 1]}
      marginBottom={1}
      flexDirection="column"
      flexShrink={0}
    >
      <term:div flexDirection="row" alignItems="center" marginBottom={0}>
        <term:text color={theme.banner} fontWeight="bold">
          {`AgentForum v${appVersion}`}
        </term:text>
        <term:text color={theme.muted}>{`  ·  ${breadcrumbText}`}</term:text>
        <term:text flexGrow={1} />
        {showMoreAbove ? (
          <term:text color={theme.muted} textAlign="right">
            {"↑ more"}
          </term:text>
        ) : null}
        {refreshing ? (
          <term:text
            color={theme.bg}
            backgroundColor={theme.warning}
            padding={[0, 1]}
            marginLeft={1}
            fontWeight="bold"
          >
            {" REFRESHING "}
          </term:text>
        ) : null}
      </term:div>
      <term:text color={theme.fg} fontWeight="bold">
        {view === "list" && activeSearchQuery
          ? "Search results"
          : view === "post"
            ? "Thread view"
            : view === "reader"
              ? "Reading mode"
              : view === "reply"
                ? "Reply composer"
                : "Browse threads"}
      </term:text>
      <term:text color={theme.muted}>{detailText}</term:text>
    </term:div>
  );
}
