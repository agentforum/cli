import React from "react";
import type { TermElement } from "terminosaurus";

import type { ReadPostBundle } from "@/domain/post.js";
import {
  buildPageLabel,
  sanitizeTerminalText,
  summarizeReactions,
  timeAgo,
} from "@/cli/commands/browse/formatters.js";
import type {
  BrowseTheme,
  ConversationItem,
  PaginatedItems,
  PanelFocus,
} from "@/cli/commands/browse/types.js";

export function PostView({
  bundle,
  actor,
  now,
  theme,
  focusedIndex,
  conversationItems,
  conversationPage,
  itemRefs,
  indexScrollRef,
  contentScrollRef,
  panelFocus,
  readProgressLabel,
  terminalWidth,
  quotedItemIds,
  quotedCount,
  activeReplyRefs,
  activeReplyRefIndex,
}: {
  bundle: ReadPostBundle | null;
  actor?: string;
  now: Date;
  theme: BrowseTheme;
  focusedIndex: number;
  conversationItems: ConversationItem[];
  conversationPage: PaginatedItems<ConversationItem>;
  itemRefs: React.MutableRefObject<Array<TermElement | null>>;
  indexScrollRef: React.MutableRefObject<TermElement | null>;
  contentScrollRef: React.MutableRefObject<TermElement | null>;
  panelFocus: PanelFocus;
  readProgressLabel: string;
  terminalWidth: number;
  quotedItemIds: Set<string>;
  quotedCount: number;
  activeReplyRefs: Array<{
    id: string;
    kind: "post" | "reply";
    label: string;
    author: string;
    replyIndex: number;
  }>;
  activeReplyRefIndex: number;
}) {
  if (!bundle) {
    return (
      <term:div
        border="rounded"
        borderColor={theme.border}
        backgroundColor={theme.surface}
        padding={[1, 2]}
      >
        <term:text color={theme.warning} fontWeight="bold">
          No thread selected
        </term:text>
        <term:text color={theme.muted}>Open a post from the list to inspect the thread.</term:text>
      </term:div>
    );
  }

  const bodyFocused = focusedIndex === -1;
  const selectedReply = focusedIndex >= 0 ? (bundle.replies[focusedIndex] ?? null) : null;
  const replyReactions = bundle.replyReactions ?? [];
  const selectedReplyReactions = selectedReply
    ? replyReactions.filter((reaction) => reaction.targetId === selectedReply.id)
    : [];
  const pageItems = conversationPage.items;
  const compact = terminalWidth < 110;
  const conversationPaneWidth = compact
    ? "100%"
    : terminalWidth >= 150
      ? 32
      : terminalWidth >= 125
        ? 28
        : 25;
  const reactionSummary = summarizeReactions(bundle.reactions);
  const selectedReplyReactionSummary = summarizeReactions(selectedReplyReactions);

  return (
    <term:div
      flexDirection={compact ? "column" : "row"}
      padding={[0, 0]}
      height="100%"
      minHeight={0}
    >
      <term:div
        width={conversationPaneWidth}
        height={compact ? 8 : "100%"}
        flexShrink={0}
        minHeight={0}
        border="rounded"
        borderColor={panelFocus === "index" ? theme.focus : theme.border}
        backgroundColor={panelFocus === "index" ? theme.surface : theme.surfaceMuted}
        padding={[0, 0]}
        marginRight={compact ? 0 : 1}
        marginBottom={compact ? 1 : 0}
        flexDirection="column"
      >
        <term:div flexDirection="column" padding={[0, 1]} flexShrink={0}>
          <term:text
            color={panelFocus === "index" ? theme.focus : theme.fg}
            fontWeight="bold"
            marginBottom={0}
          >
            {`Conversation  ${buildPageLabel(
              conversationPage.page,
              conversationPage.totalPages,
              conversationPage.rangeStart,
              conversationPage.rangeEnd,
              conversationPage.totalCount
            )}`}
          </term:text>
          <term:text color={theme.muted}>
            {`${bundle.replies.length} repl${bundle.replies.length === 1 ? "y" : "ies"}  |  ${bundle.reactions.length} original-post reaction${bundle.reactions.length === 1 ? "" : "s"}  |  ${replyReactions.length} reply reaction${replyReactions.length === 1 ? "" : "s"}  |  ${quotedCount} quote${quotedCount === 1 ? "" : "s"}  |  e react  |  Enter reader`}
          </term:text>
        </term:div>

        <term:div
          ref={indexScrollRef}
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          overflow="scroll"
          padding={[0, 1]}
        >
          <term:div height={1} />
          {conversationItems.length === 0 ? (
            <term:text color={theme.muted}>No replies yet.</term:text>
          ) : (
            pageItems.map((item, itemIndex) => {
              const absoluteIndex = conversationPage.offset + itemIndex;
              const focused = item.replyIndex === focusedIndex;
              const quoted = quotedItemIds.has(item.id);
              return (
                <term:div
                  key={item.id}
                  ref={(el: TermElement | null) => {
                    itemRefs.current[itemIndex] = el;
                  }}
                  border={focused ? "modern" : "rounded"}
                  borderColor={focused ? theme.focus : theme.border}
                  backgroundColor={focused ? theme.selected : undefined}
                  padding={[0, 1]}
                  marginBottom={1}
                >
                  <term:text color={focused ? theme.selectedFg : theme.fg} fontWeight="bold">
                    {`${focused ? "\u25B8 " : "  "}${absoluteIndex + 1}. ${item.label}${quoted ? "  [quoted]" : ""}`}
                  </term:text>
                  <term:text color={focused ? theme.selectedFg : theme.muted}>
                    {[
                      timeAgo(item.createdAt, now),
                      item.actor ? `by ${sanitizeTerminalText(item.actor)}` : null,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")}
                  </term:text>
                </term:div>
              );
            })
          )}
          <term:div height={2} />
        </term:div>
      </term:div>

      <term:div
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        border="rounded"
        borderColor={panelFocus === "content" ? theme.focus : theme.border}
        backgroundColor={panelFocus === "content" ? theme.surface : theme.surfaceMuted}
        padding={[0, 0]}
        flexDirection="column"
      >
        <term:div
          ref={contentScrollRef}
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
          overflow="scroll"
          padding={[0, 1]}
        >
          {bodyFocused ? (
            <term:div flexDirection="column">
              <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
                {`Original post${quotedItemIds.has(bundle.post.id) ? "  [quoted]" : ""}`}
              </term:text>
              <term:text color={theme.muted} marginBottom={1}>
                {[
                  sanitizeTerminalText(bundle.post.actor ?? actor ?? "unknown"),
                  bundle.post.session ? `[${sanitizeTerminalText(bundle.post.session)}]` : null,
                  timeAgo(bundle.post.createdAt, now),
                  `${bundle.reactions.length} reaction${bundle.reactions.length === 1 ? "" : "s"} on original post`,
                  bundle.post.tags.length > 0
                    ? bundle.post.tags.map((tag) => `#${sanitizeTerminalText(tag)}`).join(" ")
                    : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </term:text>
              {bundle.reactions.length > 0 ? (
                <term:div flexDirection="column" marginBottom={1}>
                  <term:text color={theme.accent} fontWeight="bold">
                    {"Original post reactions"}
                  </term:text>
                  {reactionSummary.map((line) => (
                    <term:text key={line} color={theme.warning}>
                      {line}
                    </term:text>
                  ))}
                </term:div>
              ) : null}
              <term:text whiteSpace="preWrap" color={theme.fg}>
                {sanitizeTerminalText(bundle.post.body)}
              </term:text>
              {bundle.post.refId ? (
                <term:text color={theme.accent} marginTop={1}>
                  {`Referenced post: ${bundle.post.refId}`}
                </term:text>
              ) : null}
            </term:div>
          ) : selectedReply ? (
            <term:div flexDirection="column">
              <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
                {`Reply ${focusedIndex + 1}${selectedReply && quotedItemIds.has(selectedReply.id) ? "  [quoted]" : ""}`}
              </term:text>
              <term:text color={theme.muted} marginBottom={1}>
                {[
                  sanitizeTerminalText(selectedReply.actor ?? "unknown"),
                  selectedReply.session ? `[${sanitizeTerminalText(selectedReply.session)}]` : null,
                  timeAgo(selectedReply.createdAt, now),
                  selectedReplyReactions.length > 0
                    ? `${selectedReplyReactions.length} reaction${selectedReplyReactions.length === 1 ? "" : "s"} on this reply`
                    : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ")}
              </term:text>
              {selectedReplyReactions.length > 0 ? (
                <term:div flexDirection="column" marginBottom={1}>
                  <term:text color={theme.accent} fontWeight="bold">
                    {"Reply reactions"}
                  </term:text>
                  {selectedReplyReactionSummary.map((line) => (
                    <term:text key={line} color={theme.warning}>
                      {line}
                    </term:text>
                  ))}
                </term:div>
              ) : null}
              {activeReplyRefs.length > 0 ? (
                <>
                  <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
                    {`References  ${activeReplyRefIndex + 1}/${activeReplyRefs.length}`}
                  </term:text>
                  {activeReplyRefs.map((ref, index) => (
                    <term:text
                      key={`${ref.id}-${index}`}
                      color={index === activeReplyRefIndex ? theme.selectedFg : theme.muted}
                      backgroundColor={index === activeReplyRefIndex ? theme.selected : undefined}
                    >
                      {`${index === activeReplyRefIndex ? "▸ " : "  "}${sanitizeTerminalText(ref.label)} · ${sanitizeTerminalText(ref.author)} · ${ref.id}`}
                    </term:text>
                  ))}
                  <term:text color={theme.muted} marginBottom={1}>
                    {"[ / ] select ref  ·  g open ref"}
                  </term:text>
                </>
              ) : null}
              <term:text whiteSpace="preWrap" color={theme.fg}>
                {sanitizeTerminalText(selectedReply.body)}
              </term:text>
            </term:div>
          ) : null}
          <term:text color={theme.muted} marginTop={1} textAlign="right">
            {readProgressLabel}
          </term:text>
          <term:div height={2} />
        </term:div>
      </term:div>
    </term:div>
  );
}
