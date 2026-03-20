import React from "react";
import type { TermElement } from "terminosaurus";

import type { ReadPostBundle } from "../../../../domain/post.js";
import {
  buildPageLabel,
  describeConversationFilterMode,
  estimateTokenCount,
  reactionIcon,
  sanitizeTerminalText,
  timeAgo,
} from "../formatters.js";
import type {
  BrowseTheme,
  ConversationFilterMode,
  ConversationItem,
  ConversationSortMode,
  PaginatedItems,
  PanelFocus,
} from "../types.js";

export function PostView({
  bundle,
  actor,
  now,
  theme,
  focusedIndex,
  conversationItems,
  conversationPage,
  conversationFilterMode,
  conversationSortMode,
  itemRefs,
  indexScrollRef,
  contentScrollRef,
  panelFocus,
  readProgressLabel,
  terminalWidth,
}: {
  bundle: ReadPostBundle | null;
  actor?: string;
  now: Date;
  theme: BrowseTheme;
  focusedIndex: number;
  conversationItems: ConversationItem[];
  conversationPage: PaginatedItems<ConversationItem>;
  conversationFilterMode: ConversationFilterMode;
  conversationSortMode: ConversationSortMode;
  itemRefs: React.MutableRefObject<Array<TermElement | null>>;
  indexScrollRef: React.MutableRefObject<TermElement | null>;
  contentScrollRef: React.MutableRefObject<TermElement | null>;
  panelFocus: PanelFocus;
  readProgressLabel: string;
  terminalWidth: number;
}) {
  if (!bundle) {
    return <term:text>Select a post to open it.</term:text>;
  }

  const bodyFocused = focusedIndex === -1;
  const selectedReply = focusedIndex >= 0 ? (bundle.replies[focusedIndex] ?? null) : null;
  const compact = terminalWidth < 110;
  const tokenEstimate = estimateTokenCount(
    [
      bundle.post.body,
      ...conversationPage.items.filter((item) => item.kind === "reply").map((item) => item.body),
    ].join("\n\n")
  );

  return (
    <term:div flexDirection={compact ? "column" : "row"} padding={[0, 0]} height="100%">
      <term:div
        ref={indexScrollRef}
        width={compact ? "100%" : 24}
        height={compact ? 8 : "100%"}
        flexShrink={0}
        overflow="scroll"
        border="rounded"
        borderColor={panelFocus === "index" ? theme.accent : theme.muted}
        padding={[0, 1]}
        marginRight={compact ? 0 : 1}
        marginBottom={compact ? 1 : 0}
      >
        <term:text
          color={panelFocus === "index" ? theme.accent : theme.fg}
          fontWeight="bold"
          marginBottom={0}
        >
          {"Conversation"}
        </term:text>
        <term:text color={theme.muted}>
          {buildPageLabel(
            conversationPage.page,
            conversationPage.totalPages,
            conversationPage.rangeStart,
            conversationPage.rangeEnd,
            conversationPage.totalCount
          )}
        </term:text>
        <term:text color={theme.muted} marginBottom={1}>
          {`[f] ${describeConversationFilterMode(conversationFilterMode)}  [s] ${conversationSortMode === "thread" ? "thr" : "new"}`}
        </term:text>

        {conversationItems.length === 0 ? (
          <term:text color={theme.muted}>No replies yet.</term:text>
        ) : (
          conversationItems.map((item, itemIndex) => {
            const focused = item.replyIndex === focusedIndex;
            return (
              <term:div
                key={item.id}
                ref={(el: TermElement | null) => {
                  itemRefs.current[itemIndex] = el;
                }}
                border={focused ? "modern" : "rounded"}
                borderColor={focused ? theme.accent : theme.muted}
                backgroundColor={focused ? theme.selected : undefined}
                padding={[0, 1]}
                marginBottom={1}
              >
                <term:text color={focused ? theme.selectedFg : theme.fg} fontWeight="bold">
                  {`${focused ? "\u25B8 " : "  "}${item.label}`}
                </term:text>
                <term:text color={focused ? theme.selectedFg : theme.muted}>
                  {timeAgo(item.createdAt, now)}
                </term:text>
              </term:div>
            );
          })
        )}
      </term:div>

      <term:div
        ref={contentScrollRef}
        flexGrow={1}
        flexShrink={1}
        overflow="scroll"
        border="rounded"
        borderColor={panelFocus === "content" ? theme.accent : theme.muted}
        padding={[0, 1]}
      >
        <term:text
          color={panelFocus === "content" ? theme.accent : theme.fg}
          fontWeight="bold"
          marginBottom={1}
        >
          {`Content  ~${Math.max(1, Math.round(tokenEstimate / 100) / 10)}k tokens`}
        </term:text>
        {bodyFocused ? (
          <term:div flexDirection="column">
            <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
              {"Original post"}
            </term:text>
            <term:text color={theme.success}>
              {sanitizeTerminalText(bundle.post.actor ?? actor ?? "unknown")}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {`${bundle.post.session ? `[${sanitizeTerminalText(bundle.post.session)}]  |  ` : ""}${timeAgo(bundle.post.createdAt, now)}`}
            </term:text>
            <term:text whiteSpace="preWrap" color={theme.fg}>
              {sanitizeTerminalText(bundle.post.body)}
            </term:text>
            {bundle.post.refId ? (
              <term:text color={theme.accent} marginTop={1}>
                {`Referenced post: ${bundle.post.refId}`}
              </term:text>
            ) : null}
            {bundle.reactions.length > 0 ? (
              <>
                <term:text color={theme.accent} fontWeight="bold" marginTop={1}>
                  {"Reactions"}
                </term:text>
                <term:text color={theme.warning}>
                  {bundle.reactions
                    .map(
                      (reaction) =>
                        `${reactionIcon(reaction.reaction)} ${reaction.reaction} (${reaction.actor ?? "unknown"})`
                    )
                    .join("  \u00B7  ")}
                </term:text>
              </>
            ) : null}
          </term:div>
        ) : selectedReply ? (
          <term:div flexDirection="column">
            <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
              {`Reply ${focusedIndex + 1}`}
            </term:text>
            <term:text color={theme.success}>
              {sanitizeTerminalText(selectedReply.actor ?? "unknown")}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {`${selectedReply.session ? `[${sanitizeTerminalText(selectedReply.session)}]  |  ` : ""}${timeAgo(selectedReply.createdAt, now)}`}
            </term:text>
            <term:text whiteSpace="preWrap" color={theme.fg}>
              {sanitizeTerminalText(selectedReply.body)}
            </term:text>
          </term:div>
        ) : null}
        <term:text color={theme.muted} marginTop={1} textAlign="right">
          {readProgressLabel}
        </term:text>
      </term:div>
    </term:div>
  );
}
