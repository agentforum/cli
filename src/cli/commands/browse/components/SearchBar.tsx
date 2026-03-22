import React from "react";

import {
  getSearchQualifierSuggestions,
  type SearchBuilderFieldKey,
  type SearchBuilderOperator,
  type SearchValueSuggestion,
} from "@/cli/search-query.js";
import type { BrowseTheme } from "@/cli/commands/browse/types.js";
import { buildInputViewport } from "@/cli/commands/browse/search-input.js";

export function SearchBar({
  theme,
  value,
  terminalWidth,
  maxLength,
  valueSuggestions,
  builderActive,
  builderField,
  builderOperator,
  builderValue,
  builderSelectedValueIndex,
  builderSegment,
  builderValueSuggestions,
}: {
  theme: BrowseTheme;
  value: string;
  terminalWidth: number;
  maxLength: number;
  valueSuggestions: SearchValueSuggestion[];
  builderActive: boolean;
  builderField: SearchBuilderFieldKey;
  builderOperator: SearchBuilderOperator;
  builderValue: string;
  builderSelectedValueIndex: number;
  builderSegment: "field" | "operator" | "value";
  builderValueSuggestions: SearchValueSuggestion[];
}) {
  const inset = terminalWidth >= 120 ? 10 : terminalWidth >= 90 ? 8 : 4;
  const counter = `${Array.from(value).length}/${maxLength}`;
  const contentWidth = Math.max(12, terminalWidth - inset * 2 - counter.length - 11);
  const { text, isPlaceholder } = buildInputViewport({
    value,
    placeholder: "search title, tags, body, actor, session, replies",
    visibleWidth: Math.max(1, contentWidth - 1),
  });
  const suggestions = getSearchQualifierSuggestions(value, terminalWidth >= 120 ? 4 : 3);
  const suggestionLine = suggestions
    .map((entry) => `${entry.token}${entry.description ? ` ${entry.description}` : ""}`)
    .join("  |  ");
  const valueSuggestionLine = valueSuggestions.map((entry) => entry.value).join("  |  ");
  const selectedBuilderValueIndex = Math.max(
    0,
    Math.min(builderValueSuggestions.length - 1, builderSelectedValueIndex)
  );
  const builderWindowStart = Math.max(0, selectedBuilderValueIndex - 2);
  const visibleBuilderSuggestions = builderValueSuggestions.slice(
    builderWindowStart,
    builderWindowStart + 5
  );

  return (
    <term:div
      position="absolute"
      left={inset}
      right={inset}
      bottom={4}
      border="modern"
      borderColor={theme.accent}
      backgroundColor={theme.bg}
      padding={[1, 2]}
      flexDirection="column"
    >
      <term:text color={theme.accent} fontWeight="bold" marginBottom={1}>
        {"Search threads"}
      </term:text>
      <term:div
        border="rounded"
        borderColor={Array.from(value).length >= maxLength ? theme.warning : theme.muted}
        backgroundColor={theme.surface}
        padding={[0, 1]}
        flexDirection="row"
      >
        <term:div flexGrow={1} flexDirection="row" backgroundColor={theme.surface}>
          {isPlaceholder ? (
            <>
              <term:text backgroundColor={theme.accent} color={theme.bg} whiteSpace="pre">
                {" "}
              </term:text>
              <term:text color={theme.muted} whiteSpace="pre" backgroundColor={theme.surface}>
                {text}
              </term:text>
            </>
          ) : (
            <>
              <term:text color={theme.fg} whiteSpace="pre" backgroundColor={theme.surface}>
                {text}
              </term:text>
              <term:text backgroundColor={theme.accent} color={theme.bg} whiteSpace="pre">
                {" "}
              </term:text>
            </>
          )}
        </term:div>
        <term:text
          color={Array.from(value).length >= maxLength ? theme.warning : theme.muted}
          whiteSpace="pre"
          backgroundColor={theme.surface}
        >
          {` ${counter}`}
        </term:text>
      </term:div>
      {builderActive ? (
        <term:div
          border="rounded"
          borderColor={theme.warning}
          backgroundColor={theme.surfaceMuted}
          padding={[0, 1]}
          marginTop={1}
          flexDirection="column"
        >
          <term:text color={theme.accent} fontWeight="bold">
            {"Build filter"}
          </term:text>
          <term:div flexDirection="row" marginBottom={1}>
            <term:text color={theme.muted}>{"field "}</term:text>
            <term:text
              color={builderSegment === "field" ? theme.selectedFg : theme.fg}
              backgroundColor={builderSegment === "field" ? theme.selected : undefined}
              padding={[0, 1]}
            >
              {builderField}
            </term:text>
            <term:text color={theme.muted}>{"  op "}</term:text>
            <term:text
              color={builderSegment === "operator" ? theme.selectedFg : theme.fg}
              backgroundColor={builderSegment === "operator" ? theme.selected : undefined}
              padding={[0, 1]}
            >
              {builderOperator}
            </term:text>
            <term:text color={theme.muted}>{"  value "}</term:text>
            <term:text
              color={
                builderSegment === "value"
                  ? theme.selectedFg
                  : builderValue
                    ? theme.fg
                    : theme.muted
              }
              backgroundColor={builderSegment === "value" ? theme.selected : undefined}
              padding={[0, 1]}
            >
              {builderValue || "value"}
            </term:text>
          </term:div>
          {builderSegment === "value" && visibleBuilderSuggestions.length > 0 ? (
            <term:div flexDirection="column" marginBottom={1}>
              <term:text color={theme.muted}>{"available values"}</term:text>
              {visibleBuilderSuggestions.map((entry, index) => {
                const actualIndex = builderWindowStart + index;
                const selected = actualIndex === selectedBuilderValueIndex;
                return (
                  <term:text
                    key={entry.value}
                    color={selected ? theme.selectedFg : theme.fg}
                    backgroundColor={selected ? theme.selected : undefined}
                  >
                    {`${selected ? "▸" : " "} ${entry.value}`}
                  </term:text>
                );
              })}
            </term:div>
          ) : null}
          <term:text color={theme.muted}>
            {"←→ move part  |  ↑↓ choose  |  Enter next/add  |  Esc cancel"}
          </term:text>
        </term:div>
      ) : null}
      <term:text color={theme.muted} marginTop={1}>
        {valueSuggestions.length > 0
          ? `values: ${valueSuggestionLine}`
          : suggestions.length > 0
            ? `suggest: ${suggestionLine}`
            : "Enter apply  |  / build filter  |  Tab/Shift+Tab qualifiers  |  type =, !=, ~=, or !~= then a value"}
      </term:text>
    </term:div>
  );
}
