import React from "react";

import { splitHighlightedText } from "@/cli/commands/browse/formatters.js";
import { computePickerMargins } from "@/cli/commands/browse/picker-layout.js";
import type { BrowseTheme, SelectionModalItem } from "@/cli/commands/browse/types.js";
import { ViewportInput } from "./ViewportInput.js";

function renderHighlightedText(
  text: string,
  query: string,
  options: {
    color: string;
    matchColor: string;
    fontWeight?: "bold" | "normal";
  }
): React.ReactNode[] {
  return splitHighlightedText(text, query).map((segment, index) => (
    <term:text
      key={`${index}-${segment.match ? "match" : "plain"}`}
      color={segment.match ? options.matchColor : options.color}
      fontWeight={segment.match ? "bold" : options.fontWeight}
      whiteSpace="pre"
    >
      {segment.text}
    </term:text>
  ));
}

function renderPrefixedHighlightedLine(params: {
  prefix: string;
  text: string;
  query: string;
  color: string;
  matchColor: string;
  fontWeight?: "bold" | "normal";
}): React.ReactNode {
  return (
    <term:div flexDirection="row">
      <term:text color={params.color} fontWeight={params.fontWeight} whiteSpace="pre">
        {params.prefix}
      </term:text>
      {renderHighlightedText(params.text, params.query, {
        color: params.color,
        matchColor: params.matchColor,
        fontWeight: params.fontWeight,
      })}
    </term:div>
  );
}

export function SelectionModal({
  theme,
  title,
  subtitle,
  query,
  onQueryChange,
  items,
  selectedIndex,
  visibleLimit,
  hideDescriptions,
  terminalWidth,
  terminalHeight,
}: {
  theme: BrowseTheme;
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  items: SelectionModalItem[];
  selectedIndex: number;
  visibleLimit: number;
  hideDescriptions: boolean;
  terminalWidth: number;
  terminalHeight: number;
}) {
  const margins = computePickerMargins({ terminalWidth, terminalHeight });
  const pageSize = Math.max(1, visibleLimit);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.max(0, Math.min(pageCount - 1, Math.floor(selectedIndex / pageSize)));
  const pageStart = currentPage * pageSize;
  const pageEnd = Math.min(items.length, pageStart + pageSize);
  const visibleItems = items.slice(pageStart, pageEnd);
  const effectiveSelectedIndex = Math.max(
    0,
    Math.min(visibleItems.length - 1, selectedIndex - pageStart)
  );
  const highlightQuery = query.split(",").at(-1)?.trim() ?? query.trim();
  const quickPickCount = Math.min(9, visibleItems.length);

  return (
    <term:div
      position="absolute"
      top={margins.top}
      left={margins.left}
      right={margins.right}
      bottom={margins.bottom}
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
        {`Type to filter  |  ↑/↓ move  |  PgUp/PgDn page  |  Enter apply  |  1-${quickPickCount} quick choose  |  Esc cancel`}
      </term:text>
      <term:text color={theme.muted} marginBottom={1}>
        {visibleItems.length === 0
          ? "0 results"
          : `Results ${pageStart + 1}-${pageEnd} of ${items.length}  |  Page ${currentPage + 1}/${pageCount}`}
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
                padding={[0, 2]}
                marginBottom={index < visibleItems.length - 1 ? 1 : 0}
                backgroundColor={selected ? theme.selected : undefined}
                flexDirection="column"
              >
                {renderPrefixedHighlightedLine({
                  prefix: `${selected ? "▸" : " "} ${pageStart + index + 1}. `,
                  text: item.synthetic ? `+ ${item.label}` : item.label,
                  query: highlightQuery,
                  color: selected ? theme.selectedFg : theme.fg,
                  matchColor: selected ? theme.selectedFg : theme.accent,
                  fontWeight: "bold",
                })}
                {!hideDescriptions && item.description
                  ? renderPrefixedHighlightedLine({
                      prefix: "    ",
                      text: item.description,
                      query: highlightQuery,
                      color: selected ? theme.selectedFg : theme.muted,
                      matchColor: selected ? theme.selectedFg : theme.accent,
                      fontWeight: "normal",
                    })
                  : null}
              </term:div>
            );
          })
        )}
      </term:div>
    </term:div>
  );
}
