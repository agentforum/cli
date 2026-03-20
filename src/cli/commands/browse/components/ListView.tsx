import React from "react";
import type { TermElement } from "terminosaurus";

import { excerpt, sanitizeTerminalText, statusIcon, timeAgo } from "../formatters.js";
import { getPostTypeTone, getStatusTone, severityColor } from "../theme.js";
import type { BrowseListPost, BrowseTheme, ListDisplayMode } from "../types.js";
import { StatusBadge } from "./StatusBadge.js";

export function ListView({
  posts,
  changedPostIds,
  selectedIndex,
  listItemRefs,
  now,
  theme,
  displayMode,
}: {
  posts: BrowseListPost[];
  changedPostIds: string[];
  selectedIndex: number;
  listItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  now: Date;
  theme: BrowseTheme;
  displayMode: ListDisplayMode;
}) {
  if (posts.length === 0) {
    return (
      <term:div flexDirection="column" padding={[1, 2]}>
        <term:text fontWeight="bold" color={theme.warning}>
          No threads found.
        </term:text>
        <term:text color={theme.muted}>
          Press c to change channel, u to refresh, or Tab to browse channels.
        </term:text>
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
    const right = `${post.replyCount}r  ${post.reactionCount}*  ${time}`;
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
          <term:text
            color={changed ? (selected ? theme.selectedFg : theme.warning) : mutedFg}
            whiteSpace="pre"
          >
            {changed ? "\u25CF " : "  "}
          </term:text>
          <term:text color={statusColor} fontWeight="bold" whiteSpace="pre">
            {`${icon}  `}
          </term:text>
          <term:text color={fg} fontWeight="bold">
            {excerpt(sanitizeTerminalText(post.title), 72)}
          </term:text>
          <term:text color={mutedFg} flexGrow={1} textAlign="right" whiteSpace="pre">
            {displayMode === "compact" ? right : time}
          </term:text>
        </term:div>

        {displayMode === "compact" ? (
          <>
            <term:div flexDirection="row" marginTop={0}>
              <term:text whiteSpace="pre" color={mutedFg}>
                {"     "}
              </term:text>
              <StatusBadge
                label={post.type}
                tone={
                  selected
                    ? { color: theme.selectedFg, backgroundColor: theme.muted }
                    : getPostTypeTone(post.type)
                }
              />
              <StatusBadge
                label={post.status}
                tone={
                  selected
                    ? { color: theme.selectedFg, backgroundColor: theme.muted }
                    : getStatusTone(post.status)
                }
              />
              {post.severity ? (
                <term:text
                  color={selected ? theme.selectedFg : "black"}
                  backgroundColor={selected ? theme.muted : severityColor(post.severity)}
                  padding={[0, 1]}
                  marginRight={1}
                  fontWeight="bold"
                >
                  {` ${post.severity.toUpperCase()} `}
                </term:text>
              ) : null}
              {post.blocking ? (
                <term:text
                  color={selected ? theme.selectedFg : "white"}
                  backgroundColor={selected ? theme.muted : "red"}
                  padding={[0, 1]}
                  marginRight={1}
                  fontWeight="bold"
                >
                  {" BLOCKING "}
                </term:text>
              ) : null}
              <term:text color={channelColor}>{`#${post.channel}`}</term:text>
              <term:text
                color={mutedFg}
                whiteSpace="pre"
              >{`  by ${post.actor ?? "unknown"}`}</term:text>
              {post.assignedTo ? (
                <term:text
                  color={theme.accent}
                  whiteSpace="pre"
                >{`  -> ${post.assignedTo}`}</term:text>
              ) : null}
            </term:div>
            {post.lastReplyExcerpt ? (
              <term:div flexDirection="row" whiteSpace="pre">
                <term:text color={mutedFg} whiteSpace="pre">
                  {"     \u2514 "}
                </term:text>
                <term:text color={replyActorColor} fontWeight="bold">
                  {post.lastReplyActor ?? "?"}
                </term:text>
                <term:text
                  color={mutedFg}
                  whiteSpace="pre"
                >{`: ${excerpt(sanitizeTerminalText(post.lastReplyExcerpt), 90)}`}</term:text>
              </term:div>
            ) : null}
          </>
        ) : (
          <>
            <term:div flexDirection="row">
              <term:text color={mutedFg} whiteSpace="pre">
                {"     state "}
              </term:text>
              <StatusBadge
                label={post.status}
                tone={
                  selected
                    ? { color: theme.selectedFg, backgroundColor: theme.muted }
                    : getStatusTone(post.status)
                }
              />
              {post.blocking ? (
                <term:text
                  color={selected ? theme.selectedFg : "white"}
                  backgroundColor={selected ? theme.muted : "red"}
                  padding={[0, 1]}
                  marginRight={1}
                  fontWeight="bold"
                >
                  {" BLOCKING "}
                </term:text>
              ) : null}
            </term:div>
            <term:div flexDirection="row">
              <term:text color={mutedFg} whiteSpace="pre">
                {"     kind  "}
              </term:text>
              <StatusBadge
                label={post.type}
                tone={
                  selected
                    ? { color: theme.selectedFg, backgroundColor: theme.muted }
                    : getPostTypeTone(post.type)
                }
              />
              {post.severity ? (
                <term:text
                  color={selected ? theme.selectedFg : "black"}
                  backgroundColor={selected ? theme.muted : severityColor(post.severity)}
                  padding={[0, 1]}
                  marginRight={1}
                  fontWeight="bold"
                >
                  {` ${post.severity.toUpperCase()} `}
                </term:text>
              ) : null}
            </term:div>
            <term:div flexDirection="row">
              <term:text color={mutedFg} whiteSpace="pre">
                {"     tags  "}
              </term:text>
              <term:text color={post.tags.length > 0 ? channelColor : mutedFg}>
                {post.tags.length > 0 ? post.tags.map((tag) => `#${tag}`).join(" ") : "(none)"}
              </term:text>
            </term:div>
            <term:div flexDirection="row">
              <term:text color={mutedFg} whiteSpace="pre">
                {"     owner "}
              </term:text>
              <term:text color={post.assignedTo ? theme.accent : mutedFg}>
                {post.assignedTo ?? "(unassigned)"}
              </term:text>
            </term:div>
            <term:div flexDirection="row">
              <term:text color={mutedFg} whiteSpace="pre">
                {"     author "}
              </term:text>
              <term:text color={fg}>{post.actor ?? "unknown"}</term:text>
            </term:div>
            {post.lastReplyExcerpt ? (
              <term:div flexDirection="row">
                <term:text color={mutedFg} whiteSpace="pre">
                  {"     last  "}
                </term:text>
                <term:text color={replyActorColor} fontWeight="bold">
                  {post.lastReplyActor ?? "?"}
                </term:text>
                <term:text
                  color={mutedFg}
                  whiteSpace="pre"
                >{`: ${excerpt(sanitizeTerminalText(post.lastReplyExcerpt), 84)}`}</term:text>
              </term:div>
            ) : null}
            <term:div flexDirection="row">
              <term:text color={mutedFg} whiteSpace="pre">
                {"     info  "}
              </term:text>
              <term:text color={mutedFg}>
                {`${post.replyCount} replies   ${post.reactionCount} reactions   #${post.channel}`}
              </term:text>
            </term:div>
          </>
        )}
      </term:div>
    );
  }

  return (
    <term:div flexDirection="column" padding={[0, 0]}>
      {items}
    </term:div>
  );
}
