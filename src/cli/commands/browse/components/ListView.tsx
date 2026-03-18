import React from "react";
import type { TermElement } from "terminosaurus";

import { sanitizeTerminalText, statusIcon, timeAgo } from "../formatters.js";
import { getPostTypeTone, getStatusTone, severityColor } from "../theme.js";
import type { BrowseListPost, BrowseTheme } from "../types.js";

export function ListView({
  posts,
  changedPostIds,
  selectedIndex,
  listItemRefs,
  now,
  theme
}: {
  posts: BrowseListPost[];
  changedPostIds: string[];
  selectedIndex: number;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  theme: BrowseTheme;
}) {
  if (posts.length === 0) {
    return (
      <term:div flexDirection="column" padding={[1, 2]}>
        <term:text fontWeight="bold" color={theme.warning}>
          No threads found.
        </term:text>
        <term:text color={theme.muted}>Press c to change channel, u to refresh, or Tab to browse channels.</term:text>
      </term:div>
    );
  }

  const items: React.ReactNode[] = [];
  const changedSet = new Set(changedPostIds);

  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    const selected = index === selectedIndex;
    const icon = statusIcon(post.status);
    const bg = selected ? theme.selected : undefined;
    const fg = selected ? theme.selectedFg : theme.fg;
    const mutedFg = selected ? theme.selectedFg : theme.muted;
    const pointer = selected ? "\u25B8" : " ";
    const statusColor = selected ? theme.selectedFg : getStatusTone(post.status).backgroundColor;
    const typeColor = selected ? theme.selectedFg : getPostTypeTone(post.type).backgroundColor;
    const channelColor = selected ? theme.selectedFg : theme.accent;
    const replyActorColor = selected ? theme.selectedFg : theme.success;
    const time = timeAgo(post.lastActivityAt, now);
    const right = `${post.replyCount}\u2709  ${time}`;
    const changed = changedSet.has(post.id);

    if (index > 0) {
      items.push(
        <term:text key={`sep-${post.id}`} color={theme.muted} whiteSpace="pre" padding={[0, 1]}>
          {"\u2500".repeat(72)}
        </term:text>
      );
    }

    items.push(
      <term:div
        key={post.id}
        ref={(element: TermElement | null) => {
          listItemRefs.current[index] = element;
        }}
        flexDirection="column"
        backgroundColor={bg}
        padding={[0, 1]}
      >
        <term:div flexDirection="row">
          <term:text color={selected ? theme.accent : theme.muted} whiteSpace="pre">
            {`${pointer} `}
          </term:text>
          <term:text color={changed ? (selected ? theme.selectedFg : theme.warning) : mutedFg} whiteSpace="pre">
            {changed ? "\u25CF " : "  "}
          </term:text>
          <term:text color={statusColor} fontWeight="bold" whiteSpace="pre">
            {`${icon}  `}
          </term:text>
          <term:text color={fg} fontWeight="bold">
            {sanitizeTerminalText(post.title)}
          </term:text>
          <term:text color={mutedFg} flexGrow={1} textAlign="right" whiteSpace="pre">
            {right}
          </term:text>
        </term:div>
        <term:div flexDirection="row" whiteSpace="pre">
          <term:text whiteSpace="pre" color={mutedFg}>{"     "}</term:text>
          <term:text color={typeColor}>{post.type}</term:text>
          {post.severity ? (
            <>
              <term:text color={mutedFg} whiteSpace="pre">{" \u00B7 "}</term:text>
              <term:text color={selected ? theme.selectedFg : severityColor(post.severity)} fontWeight="bold">
                {post.severity.toUpperCase()}
              </term:text>
            </>
          ) : null}
          {post.blocking ? (
            <>
              <term:text color={mutedFg} whiteSpace="pre">{" \u00B7 "}</term:text>
              <term:text color={selected ? theme.selectedFg : "red"} fontWeight="bold">
                {"BLOCKING"}
              </term:text>
            </>
          ) : null}
          <term:text color={mutedFg} whiteSpace="pre">{" \u00B7 "}</term:text>
          <term:text color={channelColor}>{`#${post.channel}`}</term:text>
          <term:text color={mutedFg} whiteSpace="pre">{` \u00B7 by ${post.actor ?? "unknown"}`}</term:text>
          {post.assignedTo ? (
            <term:text color={mutedFg} whiteSpace="pre">{` \u00B7 owner ${post.assignedTo}`}</term:text>
          ) : null}
        </term:div>
        {post.lastReplyExcerpt ? (
          <term:div flexDirection="row" whiteSpace="pre">
            <term:text color={mutedFg} whiteSpace="pre">{"     \u2514 "}</term:text>
            <term:text color={replyActorColor} fontWeight="bold">{post.lastReplyActor ?? "?"}</term:text>
            <term:text color={mutedFg} whiteSpace="pre">{`: ${sanitizeTerminalText(post.lastReplyExcerpt)}`}</term:text>
          </term:div>
        ) : null}
      </term:div>
    );
  }

  return (
    <term:div flexDirection="column" padding={[0, 0]}>
      {items}
    </term:div>
  );
}
