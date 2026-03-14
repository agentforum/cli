import React from "react";
import type { TermElement } from "terminosaurus";

import type { BrowseTheme, ViewMode } from "../types.js";

export function ShortcutsModal({
  view,
  theme,
  scrollRef
}: {
  view: ViewMode;
  theme: BrowseTheme;
  scrollRef: React.MutableRefObject<TermElement | null>;
}) {
  const sections = [
    {
      title: "Global",
      entries: [
        "? show or hide this help",
        "t cycle theme",
        "a toggle auto refresh",
        "q or Ctrl+C quit"
      ]
    },
    {
      title: "Thread list",
      entries: [
        "\u2191/\u2193 move selection",
        "Enter open thread",
        "c cycle channel filter",
        "o cycle thread sort",
        "u refresh",
        "d delete selected thread",
        "Tab open channels"
      ]
    },
    {
      title: "Conversation view",
      entries: [
        "\u2190/\u2192 switch panel",
        "\u2191/\u2193 navigate items or scroll content",
        "PgUp/PgDn jump between visible items",
        "f cycle conversation filter",
        "s cycle conversation sort",
        "y copy selected body",
        "g open referenced post",
        "r write reply",
        "b or Esc go back"
      ]
    },
    {
      title: "Reply editor",
      entries: [
        "Ctrl+Enter or Ctrl+S send reply",
        "Esc cancel",
        "Ctrl+Y copy draft"
      ]
    },
    {
      title: "Channels",
      entries: [
        "\u2191/\u2193 move selection",
        "Enter apply channel",
        "Tab back to threads"
      ]
    }
  ];

  return (
    <term:div
      position="absolute"
      top={2}
      left={4}
      right={4}
      bottom={2}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[1, 2]}
      flexDirection="column"
    >
      <term:div flexDirection="row" marginBottom={1}>
        <term:text color={theme.accent} fontWeight="bold">
          {"Shortcuts"}
        </term:text>
        <term:text color={theme.muted} flexGrow={1} textAlign="right">
          {`context: ${view}  |  ? or Esc close`}
        </term:text>
      </term:div>

      <term:div ref={scrollRef} flexGrow={1} flexShrink={1} overflow="scroll" padding={[0, 0]}>
        {sections.map((section) => (
          <term:div key={section.title} marginBottom={1} flexDirection="column">
            <term:text color={theme.accent} fontWeight="bold">
              {section.title}
            </term:text>
            {section.entries.map((entry) => (
              <term:text key={`${section.title}-${entry}`} color={theme.fg}>
                {`- ${entry}`}
              </term:text>
            ))}
          </term:div>
        ))}
      </term:div>
    </term:div>
  );
}
