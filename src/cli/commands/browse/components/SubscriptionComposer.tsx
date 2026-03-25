import React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import type {
  BrowseTheme,
  SubscriptionComposerDraft,
  SubscriptionComposerField,
} from "@/cli/commands/browse/types.js";
import { getSubscriptionComposerFieldKind } from "@/cli/commands/browse/types.js";
import { sanitizeTerminalText } from "@/cli/commands/browse/formatters.js";
import {
  isSubscriptionComposerFixedSuggestionField,
  isSubscriptionComposerPickerField,
} from "@/cli/commands/browse/composer-suggestions.js";
import { ViewportInput } from "./ViewportInput.js";

const FIELD_LABELS: Record<SubscriptionComposerField, string> = {
  mode: "Mode",
  actor: "Actor",
  channel: "Channel",
  tags: "Tags",
};

const ORDERED_FIELDS: SubscriptionComposerField[] = ["mode", "actor", "channel", "tags"];

function getFieldHint(field: SubscriptionComposerField): string {
  switch (field) {
    case "mode":
      return "required subscription action";
    case "actor":
      return "required actor id";
    case "channel":
      return "required channel name";
    case "tags":
      return "optional comma-separated tags";
  }
}

function describeFieldStatus(
  field: SubscriptionComposerField,
  draft: SubscriptionComposerDraft
): string {
  if (field === "mode") {
    return "picker-backed value";
  }
  return `typed ${Array.from(draft[field] ?? "").length} chars`;
}

function previewFieldValue(
  field: SubscriptionComposerField,
  draft: SubscriptionComposerDraft
): string {
  const value = (draft[field] ?? "").trim();
  if (!value) {
    return "(empty)";
  }
  return value.length > 32 ? `${value.slice(0, 31)}…` : value;
}

function describeFieldInputType(field: SubscriptionComposerField): string {
  if (isSubscriptionComposerFixedSuggestionField(field)) {
    return "option select";
  }
  if (field === "actor" || field === "channel" || field === "tags") {
    return "free text with search";
  }
  return "free text";
}

export function SubscriptionComposer({
  draft,
  focusedField,
  theme,
  textCursorIndex,
  inputRef,
  onFieldChange,
  fieldItemRefs,
}: {
  draft: SubscriptionComposerDraft;
  focusedField: SubscriptionComposerField;
  theme: BrowseTheme;
  textCursorIndex: number;
  inputRef: React.MutableRefObject<TermInput | null>;
  onFieldChange: (field: SubscriptionComposerField, value: string) => void;
  fieldItemRefs: React.MutableRefObject<Array<TermElement | null>>;
}) {
  const currentIndex = Math.max(0, ORDERED_FIELDS.indexOf(focusedField));
  const kind = getSubscriptionComposerFieldKind(focusedField);
  const isEnum = kind === "enum";
  const isText = kind === "text";
  const supportsPicker = isSubscriptionComposerPickerField(focusedField);
  return (
    <term:div flexDirection="column" padding={[0, 1]} height="100%" minHeight={0}>
      <term:div flexDirection="row" flexGrow={1} flexShrink={1} minHeight={0}>
        <term:div
          border="modern"
          borderColor={theme.border}
          backgroundColor={theme.surfaceMuted}
          width={28}
          marginRight={1}
          flexDirection="column"
          flexShrink={0}
          minHeight={0}
        >
          <term:div padding={[0, 1]} flexShrink={0}>
            <term:text color={theme.accent} fontWeight="bold">
              {"Fields"}
            </term:text>
            <term:text color={theme.muted}>{"Tab/Shift+Tab moves selection"}</term:text>
          </term:div>
          <term:div flexGrow={1} flexShrink={1} minHeight={0} overflow="scroll" padding={[0, 1]}>
            <term:div height={1} />
            {ORDERED_FIELDS.map((field, index) => {
              const active = field === focusedField;
              return (
                <term:div
                  key={field}
                  ref={(element: TermElement | null) => {
                    fieldItemRefs.current[index] = element;
                  }}
                  border={active ? "modern" : "rounded"}
                  borderColor={active ? theme.focus : theme.border}
                  backgroundColor={active ? theme.selected : undefined}
                  padding={[0, 1]}
                  marginBottom={1}
                >
                  <term:text color={active ? theme.selectedFg : theme.fg} fontWeight="bold">
                    {`${active ? "▸" : " "} ${FIELD_LABELS[field]}`}
                  </term:text>
                  <term:text color={active ? theme.selectedFg : theme.muted}>
                    {sanitizeTerminalText(previewFieldValue(field, draft))}
                  </term:text>
                </term:div>
              );
            })}
            <term:div height={1} />
          </term:div>
        </term:div>

        <term:div
          border="rounded"
          borderColor={theme.focus}
          backgroundColor={theme.surface}
          flexDirection="column"
          flexGrow={1}
          flexShrink={1}
          minHeight={0}
        >
          <term:div padding={[0, 1]} flexShrink={0}>
            <term:div flexDirection="row" marginBottom={1}>
              <term:text color={theme.accent} fontWeight="bold">
                {FIELD_LABELS[focusedField]}
              </term:text>
              <term:text flexGrow={1} />
              <term:text color={theme.muted}>{describeFieldStatus(focusedField, draft)}</term:text>
            </term:div>

            <term:text color={theme.muted} marginBottom={1}>
              {getFieldHint(focusedField)}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {`Input: ${describeFieldInputType(focusedField)}`}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {supportsPicker
                ? isEnum
                  ? "Enter opens a searchable picker. Left/right still cycles values."
                  : "Type freely here, Enter opens search, and left/right moves the cursor."
                : "Left/right moves the cursor in the field."}
            </term:text>
          </term:div>

          <term:div flexGrow={1} flexShrink={1} minHeight={0} padding={[0, 1]}>
            {isEnum ? (
              <term:div
                border="modern"
                borderColor={theme.focus}
                backgroundColor={theme.surface}
                padding={[0, 1]}
                minHeight={3}
              >
                <term:text color={theme.fg}>
                  {sanitizeTerminalText(draft.mode.trim() || "(unset)")}
                </term:text>
              </term:div>
            ) : isText ? (
              <ViewportInput
                theme={theme}
                value={draft[focusedField] ?? ""}
                placeholder={
                  supportsPicker ? "type a value or press Enter to search" : "type a value"
                }
                visibleWidth={56}
                cursorIndex={textCursorIndex}
                borderColor={theme.focus}
              />
            ) : (
              <term:input
                key={`subscription-input:${focusedField}`}
                ref={inputRef}
                border="modern"
                borderColor={theme.focus}
                padding={[0, 1]}
                minHeight={3}
                flexShrink={1}
                text={draft[focusedField] ?? ""}
                onChange={(event: { target: { text: string } }) => {
                  onFieldChange(focusedField, event.target.text);
                }}
              />
            )}
          </term:div>
        </term:div>
      </term:div>
    </term:div>
  );
}
