import React from "react";
import type { TermElement, TermInput } from "terminosaurus";

import {
  getPostComposerFieldKind,
  getVisiblePostComposerFields,
  type BrowseTheme,
  type PostComposerDraft,
  type PostComposerField,
} from "@/cli/commands/browse/types.js";
import { sanitizeTerminalText } from "@/cli/commands/browse/formatters.js";
import {
  isPostComposerFixedSuggestionField,
  isPostComposerPickerField,
} from "@/cli/commands/browse/composer-suggestions.js";
import { ViewportInput } from "./ViewportInput.js";

const FIELD_LABELS: Record<PostComposerField, string> = {
  channel: "Channel",
  type: "Type",
  title: "Title",
  body: "Body",
  severity: "Severity",
  data: "Data JSON",
  tags: "Tags",
  actor: "Actor",
  session: "Session",
  relationType: "Relation Type",
  relatedPostId: "Related Post",
  blocking: "Blocking",
  pinned: "Pinned",
  assignedTo: "Assign To",
  idempotencyKey: "Idempotency",
};

function getFieldHint(field: PostComposerField, draft: PostComposerDraft): string {
  switch (field) {
    case "channel":
      return "required channel name";
    case "type":
      return "required post type; preset suggestions are optional";
    case "title":
      return "required title";
    case "body":
      return "required multiline body";
    case "severity":
      return "optional core severity signal";
    case "data":
      return "optional JSON object";
    case "tags":
      return "optional comma-separated tags";
    case "actor":
      return "optional actor override";
    case "session":
      return "optional session override";
    case "relationType":
      return "optional typed relation to create with the new post";
    case "relatedPostId":
      return "optional related post; search by id, title, or author";
    case "blocking":
      return "legacy workflow flag; prefer typed relations for explicit dependencies";
    case "pinned":
      return "optional flag";
    case "assignedTo":
      return "optional owner actor";
    case "idempotencyKey":
      return "optional retry key";
  }
}

function describeFieldStatus(field: PostComposerField, draft: PostComposerDraft): string {
  const value = draft[field] ?? "";
  const kind = getPostComposerFieldKind(field);
  if (kind === "enum") {
    return "picker-backed value";
  }

  const typedCount = Array.from(value).length;
  if (kind === "multiline") {
    const lineCount = value.length > 0 ? value.split("\n").length : 1;
    return `typed ${typedCount} chars · ${lineCount} line${lineCount === 1 ? "" : "s"}`;
  }

  return `typed ${typedCount} chars`;
}

function previewFieldValue(field: PostComposerField, draft: PostComposerDraft): string {
  const rawValue = draft[field] ?? "";
  const value = rawValue.trim();

  if (!value) {
    return "(empty)";
  }

  if (field === "data" || field === "body") {
    const singleLine = rawValue.replace(/\s+/g, " ").trim();
    return singleLine.length > 32 ? `${singleLine.slice(0, 31)}…` : singleLine;
  }

  return value.length > 32 ? `${value.slice(0, 31)}…` : value;
}

function formatRelatedPostPreview(postId: string, refDetails: Record<string, string>): string {
  return refDetails[postId] ? `${postId} · ${refDetails[postId]}` : postId;
}

function describeFieldInputType(field: PostComposerField): string {
  if (isPostComposerFixedSuggestionField(field)) {
    return "option select";
  }
  if (field === "relationType") {
    return "relation catalog";
  }
  if (field === "relatedPostId") {
    return "searchable post reference";
  }
  if (
    field === "channel" ||
    field === "tags" ||
    field === "actor" ||
    field === "session" ||
    field === "assignedTo"
  ) {
    return "free text with search";
  }
  return "free text";
}

export function PostComposer({
  draft,
  focusedField,
  theme,
  refSuggestionDetails,
  textCursorIndex,
  inputRef,
  onFieldChange,
  fieldItemRefs,
}: {
  draft: PostComposerDraft;
  focusedField: PostComposerField;
  theme: BrowseTheme;
  refSuggestionDetails: Record<string, string>;
  textCursorIndex: number;
  inputRef: React.MutableRefObject<TermInput | null>;
  onFieldChange: (field: PostComposerField, value: string) => void;
  fieldItemRefs: React.MutableRefObject<Array<TermElement | null>>;
}) {
  const orderedFields = getVisiblePostComposerFields(draft);
  const currentIndex = Math.max(0, orderedFields.indexOf(focusedField));
  const kind = getPostComposerFieldKind(focusedField);
  const activeValue = draft[focusedField] ?? "";
  const isMultiline = kind === "multiline";
  const isEnum = kind === "enum";
  const isText = kind === "text";
  const supportsPicker = isPostComposerPickerField(focusedField);
  const displayValue =
    focusedField === "relatedPostId" && activeValue.trim()
      ? formatRelatedPostPreview(activeValue.trim(), refSuggestionDetails)
      : activeValue;
  return (
    <term:div flexDirection="column" padding={[0, 1]} height="100%" minHeight={0}>
      <term:div flexDirection="row" flexGrow={1} flexShrink={1} minHeight={0}>
        <term:div
          border="modern"
          borderColor={theme.border}
          backgroundColor={theme.surfaceMuted}
          width={34}
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
            {orderedFields.map((field, index) => {
              const active = field === focusedField;
              const rawPreview =
                field === "relatedPostId" && draft.relatedPostId.trim()
                  ? formatRelatedPostPreview(draft.relatedPostId.trim(), refSuggestionDetails)
                  : previewFieldValue(field, draft);
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
                    {sanitizeTerminalText(rawPreview)}
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
          overflow="hidden"
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
              {sanitizeTerminalText(getFieldHint(focusedField, draft))}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {`Input: ${describeFieldInputType(focusedField)}`}
            </term:text>
            <term:text color={theme.muted} marginBottom={1}>
              {supportsPicker
                ? isEnum
                  ? "Enter opens a searchable picker. Left/right still cycles values."
                  : "Type freely here, Enter opens search, and left/right moves the cursor."
                : isMultiline
                  ? "Arrow keys move inside the text."
                  : "Left/right moves the cursor in the field."}
            </term:text>
          </term:div>

          <term:div
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            padding={[0, 1]}
            flexDirection="column"
            overflow="hidden"
          >
            {isEnum ? (
              <term:div
                border="modern"
                borderColor={theme.focus}
                backgroundColor={theme.surface}
                padding={[0, 1]}
                minHeight={3}
              >
                <term:text color={theme.fg}>
                  {sanitizeTerminalText(displayValue || "(unset)")}
                </term:text>
              </term:div>
            ) : isText ? (
              <ViewportInput
                theme={theme}
                value={activeValue}
                placeholder={
                  supportsPicker ? "type a value or press Enter to search" : "type a value"
                }
                visibleWidth={56}
                cursorIndex={textCursorIndex}
                borderColor={theme.focus}
              />
            ) : (
              <term:input
                key={`post-input:${focusedField}`}
                ref={inputRef}
                border="modern"
                borderColor={theme.focus}
                padding={[0, 1]}
                multiline={isMultiline}
                flexGrow={isMultiline ? 1 : 0}
                flexShrink={1}
                minHeight={isMultiline ? 0 : 3}
                text={activeValue}
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
