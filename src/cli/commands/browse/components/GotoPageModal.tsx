import React from "react";
import type { TermInput } from "terminosaurus";

import type { BrowseTheme, GotoPageMode } from "../types.js";

export function GotoPageModal({
  theme,
  mode,
  totalPages,
  inputRef,
  value,
  onChange
}: {
  theme: BrowseTheme;
  mode: GotoPageMode;
  totalPages: number;
  inputRef: React.MutableRefObject<TermInput | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <term:div
      position="absolute"
      top={6}
      left={12}
      right={12}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[1, 2]}
      flexDirection="column"
    >
      <term:text color={theme.accent} fontWeight="bold" marginBottom={1}>
        {mode === "list" ? "Go to thread list page" : "Go to conversation page"}
      </term:text>
      <term:input
        ref={inputRef}
        border="rounded"
        borderColor={theme.muted}
        padding={[0, 1]}
        text={value}
        onChange={(event: { target: { text: string } }) => {
          onChange(event.target.text);
        }}
      />
      <term:text color={theme.muted} marginTop={1}>
        {`Enter page between 1 and ${Math.max(1, totalPages)}  |  Enter go  |  Esc cancel`}
      </term:text>
    </term:div>
  );
}
