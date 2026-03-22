import React from "react";
import type { TermElement } from "terminosaurus";

import {
  describeSearchMatchKind,
  excerpt,
  excerptAroundMatch,
  sanitizeTerminalText,
  splitHighlightedText,
  statusIcon,
  timeAgo,
} from "@/cli/commands/browse/formatters.js";
import type { SearchMatchRecord } from "@/domain/post.js";
import { getStatusToneForTheme } from "@/cli/commands/browse/theme.js";
import type { BrowseListPost, BrowseTheme, ListDisplayMode } from "@/cli/commands/browse/types.js";

export function ListView({
  posts,
  changedPostIds,
  selectedIndex,
  listItemRefs,
  now,
  theme,
  displayMode,
  terminalWidth,
  searchQuery,
  activeSearchQuery,
  totalCount,
}: {
  posts: BrowseListPost[];
  changedPostIds: string[];
  selectedIndex: number;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  theme: BrowseTheme;
  displayMode: ListDisplayMode;
  terminalWidth: number;
  searchQuery: string;
  activeSearchQuery: string;
  totalCount: number;
}) {
  const normalizedSearchQuery = searchQuery.trim();
  const normalizedActiveSearchQuery = activeSearchQuery.trim();

  if (posts.length === 0) {
    return (
      <term:div
        flexDirection="column"
        padding={[1, 2]}
        backgroundColor={theme.surface}
        border="rounded"
        borderColor={theme.border}
      >
        <term:text fontWeight="bold" color={theme.warning}>
          {normalizedActiveSearchQuery ? "No search results" : "No threads yet"}
        </term:text>
        {normalizedActiveSearchQuery ? (
          <>
            <term:text color={theme.muted}>
              {`Query: ${excerpt(normalizedActiveSearchQuery, Math.max(32, terminalWidth - 14))}`}
            </term:text>
            <term:text color={theme.muted}>
              {"Edit with /, or clear the query and press Enter to return to all threads."}
            </term:text>
          </>
        ) : (
          <term:text color={theme.muted}>
            Change channel, refresh the feed, or browse channels to find a thread.
          </term:text>
        )}
      </term:div>
    );
  }

  const items: React.ReactNode[] = [];
  const changedSet = new Set(changedPostIds);
  const compactMode = displayMode === "compact";
  const titleWidth = compactMode
    ? Math.max(20, Math.min(44, terminalWidth - 42))
    : Math.max(18, Math.min(40, terminalWidth - 32));
  const metaWidth = Math.max(18, Math.min(terminalWidth - 16, 84));
  const rowHeight = compactMode ? 5 : 7;

  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    const selected = index === selectedIndex;
    const icon = statusIcon(post.status);
    const bg = selected ? theme.selected : index % 2 === 0 ? theme.surface : theme.surfaceMuted;
    const fg = selected ? theme.selectedFg : theme.fg;
    const mutedFg = selected ? theme.selectedFg : theme.muted;
    const pointer = selected ? "\u258C" : "\u2502";
    const statusColor = selected
      ? theme.selectedFg
      : getStatusToneForTheme(post.status, theme).backgroundColor;
    const channelColor = selected ? theme.selectedFg : theme.accent;
    const replyActorColor = selected ? theme.selectedFg : theme.success;
    const time = timeAgo(post.lastActivityAt, now);
    const rightText = compactMode ? `${post.replyCount}r  ${post.reactionCount}*  ${time}` : time;
    const changed = changedSet.has(post.id);
    const title =
      post.searchMatch?.kind === "title"
        ? excerptAroundMatch(sanitizeTerminalText(post.title), normalizedSearchQuery, titleWidth)
        : excerpt(sanitizeTerminalText(post.title), titleWidth);
    const actor = sanitizeTerminalText(post.actor ?? "unknown");
    const assignedTo = post.assignedTo ? sanitizeTerminalText(post.assignedTo) : null;
    const channelText = `#${post.channel}`;
    const tagText =
      post.tags.length > 0
        ? excerpt(post.tags.map((tag) => `#${tag}`).join(" "), metaWidth)
        : "(none)";
    const lastReplyExcerpt = post.lastReplyExcerpt
      ? excerpt(sanitizeTerminalText(post.lastReplyExcerpt), metaWidth)
      : null;
    const searchBadge = post.searchMatch ? buildSearchBadge(post.searchMatch) : null;
    const compactMetaWidth = Math.max(12, metaWidth - (searchBadge ? searchBadge.length + 2 : 0));
    const compactMeta = excerpt(
      [
        post.type,
        post.status,
        post.severity?.toUpperCase(),
        post.blocking ? "BLOCKING" : null,
        channelText,
        `by ${actor}`,
        assignedTo ? `-> ${assignedTo}` : null,
      ]
        .filter(Boolean)
        .join("  "),
      compactMetaWidth
    );
    const compactSummary = excerpt(lastReplyExcerpt ?? `Latest activity ${time}`, metaWidth);
    const searchSummary = post.searchMatch
      ? excerptAroundMatch(post.searchMatch.excerpt, normalizedSearchQuery, metaWidth)
      : null;
    const semanticState = excerpt(
      [
        `state ${post.status}`,
        `kind ${post.type}`,
        post.severity ? `sev ${post.severity}` : null,
        post.blocking ? "BLOCKING" : null,
      ]
        .filter(Boolean)
        .join("  |  "),
      metaWidth
    );
    const semanticMeta = excerpt(
      [`author ${actor}`, assignedTo ? `owner ${assignedTo}` : "owner (unassigned)"].join("  |  "),
      metaWidth
    );
    const semanticFooter = excerpt(
      `${post.replyCount} replies  |  ${post.reactionCount} reactions  |  ${channelText}`,
      metaWidth
    );
    const matchColor = theme.bg;
    const matchBackground = selected ? theme.warning : theme.accent;
    const highlightedTitleQuery = post.searchMatch?.kind === "title" ? normalizedSearchQuery : "";
    const highlightedSummaryQuery =
      post.searchMatch && post.searchMatch.kind !== "title" ? normalizedSearchQuery : "";

    items.push(
      <term:div
        key={post.id}
        ref={(element: TermElement | null) => {
          listItemRefs.current[index] = element;
        }}
        flexDirection="column"
        backgroundColor={bg}
        border="rounded"
        borderColor={selected ? theme.focus : theme.border}
        padding={[0, 1]}
        height={rowHeight}
        marginBottom={1}
      >
        <term:div flexDirection="row" backgroundColor={bg}>
          <term:text color={selected ? theme.focus : theme.borderStrong} whiteSpace="pre">
            {`${pointer} `}
          </term:text>
          <term:text
            color={changed ? (selected ? theme.selectedFg : theme.warning) : mutedFg}
            whiteSpace="pre"
          >
            {changed ? "\u25CF " : "  "}
          </term:text>
          <term:text color={statusColor} fontWeight="bold" whiteSpace="pre">
            {`${icon}  `}
          </term:text>
          <term:div flexDirection="row" backgroundColor={bg}>
            {renderHighlightedText(title, highlightedTitleQuery, {
              color: fg,
              matchColor,
              matchBackground,
              fontWeight: "bold",
            })}
          </term:div>
          <term:text
            color={mutedFg}
            backgroundColor={bg}
            flexGrow={1}
            textAlign="right"
            whiteSpace="pre"
          >
            {rightText}
          </term:text>
        </term:div>

        {compactMode ? (
          <>
            <term:div flexDirection="row" marginTop={0} backgroundColor={bg}>
              <term:text whiteSpace="pre" color={mutedFg}>
                {"     "}
              </term:text>
              {searchBadge ? (
                <term:text
                  color={selected ? theme.selected : theme.focus}
                  backgroundColor={selected ? theme.selectedFg : theme.surfaceMuted}
                  whiteSpace="pre"
                  fontWeight="bold"
                >
                  {`${searchBadge} `}
                </term:text>
              ) : null}
              <term:text color={mutedFg} whiteSpace="pre">
                {compactMeta}
              </term:text>
            </term:div>
            <term:div flexDirection="row" whiteSpace="pre" backgroundColor={bg}>
              <term:text color={mutedFg} whiteSpace="pre">
                {"     \u2514 "}
              </term:text>
              {post.searchMatch ? (
                renderHighlightedText(searchSummary ?? "", highlightedSummaryQuery, {
                  color: mutedFg,
                  matchColor,
                  matchBackground,
                  fontWeight: "normal",
                })
              ) : (
                <>
                  <term:text color={lastReplyExcerpt ? replyActorColor : mutedFg} fontWeight="bold">
                    {lastReplyExcerpt ? (post.lastReplyActor ?? "?") : " "}
                  </term:text>
                  <term:text color={mutedFg} whiteSpace="pre">
                    {lastReplyExcerpt ? `: ${compactSummary}` : `  ${compactSummary}`}
                  </term:text>
                </>
              )}
            </term:div>
          </>
        ) : (
          <>
            <term:div flexDirection="row" backgroundColor={bg}>
              <term:text color={mutedFg} whiteSpace="pre">
                {"     state "}
              </term:text>
              <term:text color={mutedFg} whiteSpace="pre">
                {semanticState}
              </term:text>
            </term:div>
            <term:div flexDirection="row" backgroundColor={bg}>
              <term:text color={mutedFg} whiteSpace="pre">
                {"     tags  "}
              </term:text>
              <term:text color={post.tags.length > 0 ? channelColor : mutedFg} whiteSpace="pre">
                {tagText}
              </term:text>
            </term:div>
            <term:div flexDirection="row" backgroundColor={bg}>
              <term:text color={mutedFg} whiteSpace="pre">
                {"     meta  "}
              </term:text>
              <term:text color={mutedFg} whiteSpace="pre">
                {semanticMeta}
              </term:text>
            </term:div>
            <term:div flexDirection="row" backgroundColor={bg}>
              <term:text color={mutedFg} whiteSpace="pre">
                {post.searchMatch ? "     match " : "     last  "}
              </term:text>
              {post.searchMatch ? (
                <>
                  <term:text
                    color={selected ? theme.selected : theme.focus}
                    backgroundColor={selected ? theme.selectedFg : theme.surfaceMuted}
                    whiteSpace="pre"
                    fontWeight="bold"
                  >
                    {`${searchBadge ?? ""} `}
                  </term:text>
                  {renderHighlightedText(searchSummary ?? "", highlightedSummaryQuery, {
                    color: mutedFg,
                    matchColor,
                    matchBackground,
                    fontWeight: "normal",
                  })}
                </>
              ) : (
                <term:text color={lastReplyExcerpt ? replyActorColor : mutedFg} whiteSpace="pre">
                  {lastReplyExcerpt ?? "No replies yet"}
                </term:text>
              )}
            </term:div>
            <term:div flexDirection="row" backgroundColor={bg}>
              <term:text color={mutedFg} whiteSpace="pre">
                {"     info  "}
              </term:text>
              <term:text color={mutedFg} whiteSpace="pre">
                {semanticFooter}
              </term:text>
            </term:div>
          </>
        )}
      </term:div>
    );
  }

  return (
    <term:div flexDirection="column" padding={[0, 0]}>
      {normalizedActiveSearchQuery ? (
        <term:div
          flexDirection="column"
          padding={[0, 1]}
          marginBottom={1}
          border="rounded"
          borderColor={theme.accent}
          backgroundColor={theme.surface}
        >
          <term:text color={theme.accent} fontWeight="bold">
            {`Search results  |  ${totalCount} match${totalCount === 1 ? "" : "es"}`}
          </term:text>
          <term:text color={theme.muted}>
            {excerpt(normalizedActiveSearchQuery, Math.max(32, terminalWidth - 12))}
          </term:text>
        </term:div>
      ) : null}
      <term:div height={1} />
      {items}
      <term:div height={2} />
    </term:div>
  );
}

function buildSearchBadge(searchMatch: SearchMatchRecord): string {
  const extraMatches = Math.max(0, searchMatch.kinds.length - 1);
  return `[${describeSearchMatchKind(searchMatch.kind)}${extraMatches > 0 ? `+${extraMatches}` : ""}]`;
}

function renderHighlightedText(
  text: string,
  query: string,
  options: {
    color: string;
    matchColor: string;
    matchBackground: string;
    fontWeight: "bold" | "normal";
  }
): React.ReactNode[] {
  return splitHighlightedText(text, query).map((segment, index) => (
    <term:text
      key={`${index}-${segment.match ? "match" : "plain"}`}
      color={segment.match ? options.matchColor : options.color}
      backgroundColor={segment.match ? options.matchBackground : undefined}
      fontWeight={segment.match ? "bold" : options.fontWeight}
      whiteSpace="pre"
    >
      {segment.text}
    </term:text>
  ));
}
