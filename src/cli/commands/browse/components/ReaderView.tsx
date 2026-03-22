import React from "react";
import type { TermElement } from "terminosaurus";

import type { ReadPostBundle } from "@/domain/post.js";
import {
  sanitizeTerminalText,
  summarizeReactions,
  timeAgo,
} from "@/cli/commands/browse/formatters.js";
import type { BrowseTheme } from "@/cli/commands/browse/types.js";

export function ReaderView({
  bundle,
  actor,
  now,
  theme,
  focusedIndex,
  scrollRef,
  readProgressLabel,
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
  scrollRef: React.MutableRefObject<TermElement | null>;
  readProgressLabel: string;
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
    return null;
  }

  const bodyFocused = focusedIndex === -1;
  const selectedReply = focusedIndex >= 0 ? (bundle.replies[focusedIndex] ?? null) : null;
  const replyReactions = bundle.replyReactions ?? [];
  const selectedReplyReactions = selectedReply
    ? replyReactions.filter((reaction) => reaction.targetId === selectedReply.id)
    : [];
  const currentItem = focusedIndex < 0 ? 1 : focusedIndex + 2;
  const totalItems = bundle.replies.length + 1;
  const reactionSummary = summarizeReactions(bundle.reactions);
  const selectedReplyReactionSummary = summarizeReactions(selectedReplyReactions);
  const activeItemId = bodyFocused ? bundle.post.id : selectedReply?.id;
  const activeQuoted = activeItemId ? quotedItemIds.has(activeItemId) : false;

  return (
    <term:div
      border="rounded"
      borderColor={theme.focus}
      backgroundColor={theme.surface}
      padding={[0, 0]}
      flexDirection="column"
      height="100%"
      minHeight={0}
    >
      <term:div padding={[0, 1]} flexShrink={0}>
        <term:text color={theme.accent} fontWeight="bold">
          {`${bodyFocused ? "Original post" : `Reply ${focusedIndex + 1}`}${activeQuoted ? "  [quoted]" : ""}  |  item ${currentItem}/${totalItems}`}
        </term:text>
        <term:text color={theme.muted}>
          {`${bundle.replies.length} repl${bundle.replies.length === 1 ? "y" : "ies"}  |  ${bundle.reactions.length} original-post reaction${bundle.reactions.length === 1 ? "" : "s"}  |  ${replyReactions.length} reply reaction${replyReactions.length === 1 ? "" : "s"}  |  ${quotedCount} quote${quotedCount === 1 ? "" : "s"}  |  PgUp/PgDn fast scroll  |  j/k or n/p move  |  e react  |  w toggle quote  |  r reply  |  y copy body  |  X context  |  Esc back`}
        </term:text>
      </term:div>

      <term:div
        ref={scrollRef}
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        overflow="scroll"
        padding={[0, 2]}
      >
        <term:text color={theme.muted} marginBottom={1}>
          {(bodyFocused
            ? [
                sanitizeTerminalText(bundle.post.actor ?? actor ?? "unknown"),
                bundle.post.session ? `[${sanitizeTerminalText(bundle.post.session)}]` : null,
                timeAgo(bundle.post.createdAt, now),
                `${bundle.reactions.length} reaction${bundle.reactions.length === 1 ? "" : "s"} on original post`,
                bundle.post.tags.length > 0
                  ? bundle.post.tags.map((tag) => `#${sanitizeTerminalText(tag)}`).join(" ")
                  : null,
              ]
            : selectedReply
              ? [
                  sanitizeTerminalText(selectedReply.actor ?? "unknown"),
                  selectedReply.session ? `[${sanitizeTerminalText(selectedReply.session)}]` : null,
                  timeAgo(selectedReply.createdAt, now),
                  selectedReplyReactions.length > 0
                    ? `${selectedReplyReactions.length} reaction${selectedReplyReactions.length === 1 ? "" : "s"} on this reply`
                    : null,
                ]
              : []
          )
            .filter(Boolean)
            .join("  ·  ")}
        </term:text>
        {bodyFocused && bundle.reactions.length > 0 ? (
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
        {!bodyFocused && selectedReplyReactions.length > 0 ? (
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

        {!bodyFocused && activeReplyRefs.length > 0 ? (
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
          {sanitizeTerminalText(
            bodyFocused ? bundle.post.body : (selectedReply?.body ?? "Reply no longer available.")
          )}
        </term:text>

        {bodyFocused && bundle.post.refId ? (
          <term:text color={theme.accent} marginTop={1}>
            {`Referenced post: ${bundle.post.refId}`}
          </term:text>
        ) : null}

        <term:text color={theme.muted} marginTop={1} textAlign="right">
          {readProgressLabel}
        </term:text>
        <term:div height={2} />
      </term:div>
    </term:div>
  );
}
