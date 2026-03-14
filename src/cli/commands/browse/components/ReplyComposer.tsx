import React from "react";
import type { TermInput } from "terminosaurus";

import type { ReadPostBundle } from "../../../../domain/post.js";
import { sanitizeTerminalText } from "../formatters.js";
import type { BrowseTheme } from "../types.js";

export function ReplyComposer({
  bundle,
  replyBody,
  actor,
  inputRef,
  onReplyBodyChange,
  theme
}: {
  bundle: ReadPostBundle | null;
  replyBody: string;
  actor?: string;
  inputRef: React.MutableRefObject<TermInput | null>;
  onReplyBodyChange: (value: string) => void;
  theme: BrowseTheme;
}) {
  if (!bundle) {
    return <term:text>Select a post before replying.</term:text>;
  }

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
        {"\u2500\u2500 Your reply \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500"}
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
    </term:div>
  );
}
