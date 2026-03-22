import React from "react";
import type { TermElement } from "terminosaurus";

import type { BrowseTheme, ViewMode } from "@/cli/commands/browse/types.js";

export function ShortcutsModal({
  view,
  theme,
  scrollRef,
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
        "q or Ctrl+C quit",
      ],
    },
    {
      title: "Thread list",
      entries: [
        "\u2191/\u2193 move selection",
        "Enter open thread",
        "PgUp/PgDn or [ / ] previous or next page",
        "G goto page",
        "/ search text or qualifiers",
        "Esc clear active search",
        "c cycle channel filter",
        "o cycle thread sort",
        "v cycle list view",
        "u refresh",
        "d delete selected thread",
        "Tab open channels",
      ],
    },
    {
      title: "Conversation view",
      entries: [
        "\u2190/\u2192 switch panel",
        "\u2191/\u2193 navigate items or scroll content",
        "PgUp/PgDn fast scroll current content",
        "Enter open distraction free reader",
        "G goto page",
        "e or Shift+R react to the focused post or reply",
        "[ / ] move between quoted refs on the selected reply",
        "f cycle conversation filter",
        "s cycle conversation sort",
        "y copy selected body",
        "w or Shift+Q toggle quote on original post or focused reply",
        "X copy context pack",
        "g open selected quoted ref or thread reference",
        "r write reply",
        "b or Esc go back",
      ],
    },
    {
      title: "Reply editor",
      entries: [
        "Tab / Shift+Tab move between quote list, preview, and editor",
        "j / k or ↑ / ↓ move through selected quotes",
        "PgUp / PgDn scroll the quote preview",
        "Ctrl+S send reply",
        "Ctrl+K clear selected quotes",
        "Esc cancel",
        "Ctrl+Y copy draft",
      ],
    },
    {
      title: "Reader",
      entries: [
        "PgUp / PgDn fast scroll current content",
        "j / k or n / p previous or next thread item",
        "e or Shift+R react to the active post or reply",
        "[ / ] move between quoted refs on the active reply",
        "g open selected quoted ref",
        "\u2191 / \u2193 scroll current content",
        "w or Shift+Q toggle quote on current item",
        "r open reply composer with selected quotes",
        "y copy selected body",
        "X copy thread context pack",
        "b or Esc back to split view",
      ],
    },
    {
      title: "Reaction picker",
      entries: [
        "↑ / ↓ or j / k move selection",
        "1-9 quick choose a reaction",
        "Enter apply selected reaction",
        "Esc cancel",
      ],
    },
    {
      title: "Search overlay",
      entries: [
        "Enter apply search",
        "/ open filter builder",
        "Tab / Shift+Tab cycle freeform qualifiers before =, !=, ~=, or !~=",
        "inside builder: ←→ part, ↑↓ choose, Enter confirm",
        "/tag= exact tag match, /tag~= partial tag match",
        "/actor!= and /tag!~= negative matches",
        "/actor /session /assigned /reply-actor /reply-session /channel /status",
        "Esc close without applying",
      ],
    },
    {
      title: "Channels",
      entries: ["\u2191/\u2193 move selection", "Enter apply channel", "Tab back to threads"],
    },
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
