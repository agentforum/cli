import React from "react";

import type { BrowseTheme, SelectionModalItem } from "@/cli/commands/browse/types.js";
import { ViewportInput } from "./ViewportInput.js";

export function SelectionModal({
  theme,
  title,
  subtitle,
  query,
  onQueryChange,
  items,
  selectedIndex,
}: {
  theme: BrowseTheme;
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  items: SelectionModalItem[];
  selectedIndex: number;
}) {
  const visibleItems = items.slice(0, 9);
  const effectiveSelectedIndex = Math.max(0, Math.min(visibleItems.length - 1, selectedIndex));

  return (
    <term:div
      position="absolute"
      top={5}
      left={8}
      right={8}
      bottom={5}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[1, 2]}
      flexDirection="column"
      minHeight={0}
    >
      <term:text color={theme.accent} fontWeight="bold">
        {title}
      </term:text>
      <term:text color={theme.muted} marginBottom={1}>
        {subtitle}
      </term:text>
      <ViewportInput
        theme={theme}
        value={query}
        placeholder="type to filter values"
        visibleWidth={64}
        borderColor={theme.focus}
      />
      <term:text color={theme.muted} marginTop={1} marginBottom={1}>
        {"Type to filter  |  ↑/↓ move  |  Enter apply  |  1-9 quick choose  |  Esc cancel"}
      </term:text>
      <term:div flexGrow={1} flexShrink={1} minHeight={0} overflow="scroll">
        {visibleItems.length === 0 ? (
          <term:text color={theme.muted}>{"No matching results."}</term:text>
        ) : (
          visibleItems.map((item, index) => {
            const selected = index === effectiveSelectedIndex;
            return (
              <term:div
                key={`${item.value}:${index}`}
                padding={[0, 1]}
                marginBottom={1}
                backgroundColor={selected ? theme.selected : undefined}
              >
                <term:text color={selected ? theme.selectedFg : theme.fg} fontWeight="bold">
                  {`${selected ? "▸" : " "} ${index + 1}. ${item.label}`}
                </term:text>
                {item.description ? (
                  <term:text color={selected ? theme.selectedFg : theme.muted}>
                    {item.description}
                  </term:text>
                ) : null}
              </term:div>
            );
          })
        )}
      </term:div>
    </term:div>
  );
}
