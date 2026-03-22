import React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type { ReadPostBundle } from "@/domain/post.js";
import { sanitizeTerminalText } from "@/cli/commands/browse/formatters.js";
import type { BrowseTheme, ReplyQuote } from "@/cli/commands/browse/types.js";

export function ReplyComposer({
  bundle,
  replyBody,
  replyQuotes,
  selectedReplyQuote,
  replySectionFocus,
  replyFocusedQuoteId,
  actor,
  inputRef,
  quotesListRef,
  quotePreviewRef,
  quoteItemRefs,
  onReplyBodyChange,
  theme,
  terminalWidth,
  terminalHeight,
}: {
  bundle: ReadPostBundle | null;
  replyBody: string;
  replyQuotes: ReplyQuote[];
  selectedReplyQuote: ReplyQuote | null;
  replySectionFocus: "quotes" | "preview" | "editor";
  replyFocusedQuoteId: string | null;
  actor?: string;
  inputRef: React.MutableRefObject<TermInput | null>;
  quotesListRef: React.MutableRefObject<TermElement | null>;
  quotePreviewRef: React.MutableRefObject<TermElement | null>;
  quoteItemRefs: React.MutableRefObject<Array<TermElement | null>>;
  onReplyBodyChange: (value: string) => void;
  theme: BrowseTheme;
  terminalWidth: number;
  terminalHeight: number;
}) {
  if (!bundle) {
    return <term:text>Select a post before replying.</term:text>;
  }

  const compact = terminalWidth < 110;
  const topPaneHeight =
    replyQuotes.length > 0
      ? Math.min(compact ? 14 : 12, Math.max(8, Math.floor(terminalHeight / 3)))
      : 3;
  const inputMinHeight = compact ? 9 : 8;
  const metadata = `by you (${actor ?? "unknown"}) · #${bundle.post.channel}`;

  return (
    <term:div flexDirection="column" padding={[0, 1]} height="100%" minHeight={0}>
      <term:div flexDirection="row" marginBottom={1} flexShrink={0}>
        <term:text color={theme.accent} fontWeight="bold">
          {sanitizeTerminalText(`\u270E Replying to: ${bundle.post.title}`)}
        </term:text>
        <term:text color={theme.muted} flexGrow={1} textAlign="right">
          {bundle.post.id}
        </term:text>
      </term:div>
      <term:text color={theme.muted} marginBottom={1} flexShrink={0}>
        {metadata}
      </term:text>
      {replyQuotes.length > 0 ? (
        <term:div
          flexDirection={compact ? "column" : "row"}
          height={topPaneHeight}
          flexShrink={0}
          marginBottom={1}
        >
          <term:div
            ref={quotesListRef}
            border="rounded"
            borderColor={replySectionFocus === "quotes" ? theme.focus : theme.muted}
            backgroundColor={replySectionFocus === "quotes" ? theme.surface : theme.surfaceMuted}
            width={compact ? "100%" : 30}
            height={compact ? 5 : "100%"}
            flexShrink={0}
            marginRight={compact ? 0 : 1}
            marginBottom={compact ? 1 : 0}
            padding={[0, 1]}
            overflow="scroll"
            flexDirection="column"
          >
            <term:text color={theme.accent} fontWeight="bold">
              {`Quoted context  (${replyQuotes.length})`}
            </term:text>
            {replyQuotes.map((quote, index) => {
              const selected = quote.id === (replyFocusedQuoteId ?? selectedReplyQuote?.id);
              return (
                <term:div key={quote.id} marginBottom={1} flexDirection="column">
                  <term:div
                    ref={(el: TermElement | null) => {
                      quoteItemRefs.current[index] = el;
                    }}
                  >
                    <term:text
                      color={selected ? theme.selectedFg : theme.fg}
                      backgroundColor={selected ? theme.selected : undefined}
                      fontWeight="bold"
                    >
                      {`${selected ? "▸ " : "  "}${index + 1}. ${sanitizeTerminalText(quote.label)}`}
                    </term:text>
                    <term:text color={selected ? theme.selectedFg : theme.muted}>
                      {sanitizeTerminalText(`@${quote.author}`)}
                    </term:text>
                  </term:div>
                </term:div>
              );
            })}
          </term:div>

          <term:div
            ref={quotePreviewRef}
            border="rounded"
            borderColor={replySectionFocus === "preview" ? theme.focus : theme.muted}
            backgroundColor={replySectionFocus === "preview" ? theme.surface : theme.surfaceMuted}
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            padding={[0, 1]}
            overflow="scroll"
            flexDirection="column"
          >
            <term:text color={theme.accent} fontWeight="bold">
              {"Quote preview"}
            </term:text>
            {selectedReplyQuote ? (
              <>
                <term:text color={theme.success} fontWeight="bold">
                  {`[@${selectedReplyQuote.author} · ${sanitizeTerminalText(selectedReplyQuote.label.toLowerCase())}]`}
                </term:text>
                <term:text whiteSpace="preWrap" color={theme.fg}>
                  {sanitizeTerminalText(selectedReplyQuote.text)}
                </term:text>
              </>
            ) : (
              <term:text color={theme.muted}>{"Select a quoted item to preview it."}</term:text>
            )}
          </term:div>
        </term:div>
      ) : (
        <term:div
          border="rounded"
          borderColor={theme.muted}
          backgroundColor={theme.surfaceMuted}
          padding={[0, 1]}
          marginBottom={1}
          flexShrink={0}
        >
          <term:text color={theme.muted}>
            {
              "No quotes selected. Press w or Shift+Q on the original post or any reply, then r to answer."
            }
          </term:text>
        </term:div>
      )}
      <term:div
        border="rounded"
        borderColor={replySectionFocus === "editor" ? theme.focus : theme.muted}
        backgroundColor={replySectionFocus === "editor" ? theme.surface : theme.surfaceMuted}
        padding={[0, 1]}
        flexGrow={1}
        flexShrink={1}
        minHeight={0}
        flexDirection="column"
      >
        <term:text color={theme.accent} fontWeight="bold" flexShrink={0}>
          {"Your reply"}
        </term:text>
        <term:input
          ref={inputRef}
          border="modern"
          borderColor={replySectionFocus === "editor" ? theme.focus : theme.border}
          multiline
          flexGrow={1}
          flexShrink={1}
          minHeight={inputMinHeight}
          padding={[0, 1]}
          text={replyBody}
          onChange={(event: { target: { text: string } }) => {
            onReplyBodyChange(event.target.text);
          }}
        />
      </term:div>
    </term:div>
  );
}
