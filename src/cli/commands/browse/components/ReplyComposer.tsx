import React from "react";
import type { TermInput } from "terminosaurus";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { sanitizeTerminalText } from "../formatters.js";
import type { BrowseTheme, ReplyQuote } from "../types.js";

export function ReplyComposer({
  bundle,
  replyBody,
  replyQuote,
  actor,
  inputRef,
  onReplyBodyChange,
  theme,
}: {
  bundle: ReadPostBundle | null;
  replyBody: string;
  replyQuote: ReplyQuote | null;
  actor?: string;
  inputRef: React.MutableRefObject<TermInput | null>;
  onReplyBodyChange: (value: string) => void;
  theme: BrowseTheme;
}) {
  if (!bundle) {
    return <term:text>Select a post before replying.</term:text>;
  }

  const defaultResolveStatus = bundle.post.status === "open" ? "answered" : bundle.post.status;

  return (
    <term:div flexDirection="column" padding={[0, 1]}>
      <term:div flexDirection="row" marginBottom={1}>
        <term:text color={theme.accent} fontWeight="bold">
          {sanitizeTerminalText(`\u270E Replying to: ${bundle.post.title}`)}
        </term:text>
        <term:text color={theme.muted} flexGrow={1} textAlign="right">
          {bundle.post.id}
        </term:text>
      </term:div>
      <term:text color={theme.muted} marginBottom={1}>
        {`by you (${actor ?? "unknown"}) \u00B7 #${bundle.post.channel}`}
      </term:text>
      <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
        {
          "\u2500\u2500 Quote / context \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"
        }
      </term:text>
      {replyQuote ? (
        <term:div border="rounded" borderColor={theme.muted} padding={[0, 1]} marginBottom={1}>
          <term:text color={theme.success} fontWeight="bold">
            {`[@${replyQuote.author} · reply #${replyQuote.replyIndex + 1}]`}
          </term:text>
          <term:text whiteSpace="preWrap" color={theme.muted}>
            {sanitizeTerminalText(replyQuote.text)}
          </term:text>
          <term:text color={theme.muted}>{"Ctrl+K clears the quote before sending."}</term:text>
        </term:div>
      ) : (
        <term:text color={theme.muted} marginBottom={1}>
          {"No quote selected. Press Q from a reply to quote it here."}
        </term:text>
      )}
      <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
        {
          "\u2500\u2500 Your reply \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"
        }
      </term:text>
      <term:input
        ref={inputRef}
        border="modern"
        borderColor={theme.accent}
        multiline
        autoHeight
        padding={[0, 1]}
        text={replyBody}
        onChange={(event: { target: { text: string } }) => {
          onReplyBodyChange(event.target.text);
        }}
      />
      <term:text color={theme.accent} fontWeight="bold" marginTop={1}>
        {
          "\u2500\u2500 Tools (copy and paste) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"
        }
      </term:text>
      <term:text
        color={theme.muted}
      >{`af reply --post ${bundle.post.id} --body "..."${actor ? ` --actor ${actor}` : ""}`}</term:text>
      <term:text
        color={theme.muted}
      >{`af react --id ${bundle.post.id} --reaction confirmed|contradicts|acting-on|needs-human`}</term:text>
      <term:text
        color={theme.muted}
      >{`af resolve --id ${bundle.post.id} --status ${defaultResolveStatus}`}</term:text>
      <term:text
        color={theme.muted}
      >{`af assign --id ${bundle.post.id} --actor <agent>`}</term:text>
    </term:div>
  );
}
