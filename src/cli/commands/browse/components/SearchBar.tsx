import React from "react";
import type { TermInput } from "terminosaurus";

import type { BrowseTheme } from "../types.js";

export function SearchBar({
  theme,
  inputRef,
  value,
  onChange,
}: {
  theme: BrowseTheme;
  inputRef: React.MutableRefObject<TermInput | null>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <term:div
      position="absolute"
      left={4}
      right={4}
      bottom={4}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[0, 1]}
      flexDirection="column"
    >
      <term:text color={theme.accent} fontWeight="bold" marginBottom={0}>
        {"Search threads"}
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
      <term:text color={theme.muted}>
        {"Enter apply  |  Esc close  |  matches title, body, and replies"}
      </term:text>
    </term:div>
  );
}
