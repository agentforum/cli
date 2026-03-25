import React from "react";

import type { BrowseTheme } from "@/cli/commands/browse/types.js";
import { buildSingleLineEditorDisplay } from "@/cli/commands/browse/search-input.js";

export function ViewportInput({
  theme,
  value,
  placeholder,
  visibleWidth,
  cursorIndex,
  borderColor,
  trailingText,
  trailingColor,
}: {
  theme: BrowseTheme;
  value: string;
  placeholder: string;
  visibleWidth: number;
  cursorIndex?: number;
  borderColor: string;
  trailingText?: string;
  trailingColor?: string;
}) {
  const display = buildSingleLineEditorDisplay({
    value,
    placeholder,
    visibleWidth,
    cursorIndex: cursorIndex ?? Array.from(value).length,
  });

  return (
    <term:div
      border="rounded"
      borderColor={borderColor}
      backgroundColor={theme.surface}
      padding={[0, 1]}
      flexDirection="column"
    >
      <term:div flexDirection="row" backgroundColor={theme.surface}>
        <term:text
          color={display.isPlaceholder ? theme.muted : theme.fg}
          whiteSpace="pre"
          backgroundColor={theme.surface}
          flexGrow={1}
        >
          {display.text}
        </term:text>
        {trailingText ? (
          <term:text
            color={trailingColor ?? theme.muted}
            whiteSpace="pre"
            backgroundColor={theme.surface}
          >
            {` ${trailingText}`}
          </term:text>
        ) : null}
      </term:div>
      <term:text color={theme.accent} whiteSpace="pre" backgroundColor={theme.surface}>
        {`${" ".repeat(display.caretOffset)}^`}
      </term:text>
    </term:div>
  );
}
