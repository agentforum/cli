import React from "react";

import {
  describeReaction,
  reactionIcon,
  sanitizeTerminalText,
} from "@/cli/commands/browse/formatters.js";
import type { BrowseTheme } from "@/cli/commands/browse/types.js";

export function ReactionPickerModal({
  theme,
  selectedIndex,
  targetLabel,
  reactions,
}: {
  theme: BrowseTheme;
  selectedIndex: number;
  targetLabel: string;
  reactions: string[];
}) {
  return (
    <term:div
      position="absolute"
      top={4}
      left={8}
      right={8}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[1, 2]}
      flexDirection="column"
    >
      <term:text color={theme.accent} fontWeight="bold">
        {`React to ${sanitizeTerminalText(targetLabel)}`}
      </term:text>
      <term:text color={theme.muted} marginBottom={1}>
        {`↑/↓ or j/k move  |  Enter apply  |  1-${Math.min(9, reactions.length)} quick choose  |  Esc cancel`}
      </term:text>
      {reactions.map((reaction, index) => {
        const selected = index === selectedIndex;
        return (
          <term:div
            key={reaction}
            padding={[0, 1]}
            marginBottom={index === reactions.length - 1 ? 0 : 1}
            backgroundColor={selected ? theme.selected : undefined}
          >
            <term:text
              color={selected ? theme.selectedFg : theme.fg}
              fontWeight={selected ? "bold" : undefined}
            >
              {`${selected ? "▸" : " "} ${index + 1}. ${reactionIcon(reaction)} ${describeReaction(reaction)}`}
            </term:text>
          </term:div>
        );
      })}
    </term:div>
  );
}
