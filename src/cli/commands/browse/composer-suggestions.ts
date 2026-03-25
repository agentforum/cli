import type { PostComposerField, SelectionModalItem, SubscriptionComposerField } from "./types.js";

type SuggestionLookup = Partial<Record<string, string[]>>;
const POST_ENUM_SUGGESTIONS: Partial<Record<PostComposerField, string[]>> = {
  type: ["finding", "question", "decision", "note"],
  severity: ["critical", "warning", "info"],
  blocking: ["true", "false"],
  pinned: ["true", "false"],
};
const SUBSCRIPTION_ENUM_SUGGESTIONS: Partial<Record<SubscriptionComposerField, string[]>> = {
  mode: ["subscribe", "unsubscribe"],
};

export function isPostComposerFixedSuggestionField(field: PostComposerField): boolean {
  return field in POST_ENUM_SUGGESTIONS;
}

export function isSubscriptionComposerFixedSuggestionField(
  field: SubscriptionComposerField
): boolean {
  return field in SUBSCRIPTION_ENUM_SUGGESTIONS;
}

export function isPostComposerPickerField(field: PostComposerField): boolean {
  return (
    field === "channel" ||
    field === "type" ||
    field === "severity" ||
    field === "tags" ||
    field === "actor" ||
    field === "session" ||
    field === "refId" ||
    field === "blocking" ||
    field === "pinned" ||
    field === "assignedTo"
  );
}

export function isSubscriptionComposerPickerField(field: SubscriptionComposerField): boolean {
  return field === "mode" || field === "actor" || field === "channel" || field === "tags";
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function filterByQuery(values: string[], query: string, limit: number): string[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return values.slice(0, limit);
  }

  const ranked = values
    .filter((value) => value.toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => {
      const leftLower = left.toLocaleLowerCase();
      const rightLower = right.toLocaleLowerCase();
      const leftStarts = leftLower.startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = rightLower.startsWith(normalizedQuery) ? 0 : 1;
      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }
      return left.localeCompare(right);
    });

  return ranked.slice(0, limit);
}

export function buildPostComposerSuggestionLookup(values: {
  channels: string[];
  actors: string[];
  sessions: string[];
  assignedTo: string[];
  refIds: string[];
  tags: string[];
}): SuggestionLookup {
  return {
    channel: uniqueSorted(values.channels),
    actor: uniqueSorted(values.actors),
    session: uniqueSorted(values.sessions),
    assignedTo: uniqueSorted(values.assignedTo),
    refId: uniqueSorted(values.refIds),
    tags: uniqueSorted(values.tags),
  };
}

export function buildSubscriptionComposerSuggestionLookup(values: {
  channels: string[];
  actors: string[];
  tags: string[];
}): SuggestionLookup {
  return {
    channel: uniqueSorted(values.channels),
    actor: uniqueSorted(values.actors),
    tags: uniqueSorted(values.tags),
  };
}

export function resolvePostComposerSuggestions(
  field: PostComposerField,
  value: string,
  lookup: SuggestionLookup,
  limit = 6
): string[] {
  const candidates = POST_ENUM_SUGGESTIONS[field] ?? lookup[field] ?? [];
  if (field === "tags") {
    const parts = value.split(",");
    const activeSegment = parts[parts.length - 1]?.trim() ?? "";
    return filterByQuery(candidates, activeSegment, limit);
  }
  return filterByQuery(candidates, value, limit);
}

export function resolveSubscriptionComposerSuggestions(
  field: SubscriptionComposerField,
  value: string,
  lookup: SuggestionLookup,
  limit = 6
): string[] {
  const candidates = SUBSCRIPTION_ENUM_SUGGESTIONS[field] ?? lookup[field] ?? [];
  if (field === "tags") {
    const parts = value.split(",");
    const activeSegment = parts[parts.length - 1]?.trim() ?? "";
    return filterByQuery(candidates, activeSegment, limit);
  }
  return filterByQuery(candidates, value, limit);
}

export function applyPostComposerSuggestion(
  field: PostComposerField,
  currentValue: string,
  suggestion: string
): string {
  if (field !== "tags") {
    return suggestion;
  }

  const parts = currentValue.split(",");
  if (parts.length === 0) {
    return suggestion;
  }

  parts[parts.length - 1] = ` ${suggestion}`;
  return parts
    .map((part, index) => (index === 0 ? part.trimStart() : part))
    .join(",")
    .replace(/^,\s*/, "");
}

export function applySubscriptionComposerSuggestion(
  field: SubscriptionComposerField,
  currentValue: string,
  suggestion: string
): string {
  if (field !== "tags") {
    return suggestion;
  }

  const parts = currentValue.split(",");
  if (parts.length === 0) {
    return suggestion;
  }

  parts[parts.length - 1] = ` ${suggestion}`;
  return parts
    .map((part, index) => (index === 0 ? part.trimStart() : part))
    .join(",")
    .replace(/^,\s*/, "");
}

function buildItems(values: string[], mapLabel?: (value: string) => string): SelectionModalItem[] {
  return values.map((value) => ({
    value,
    label: mapLabel ? mapLabel(value) : value,
  }));
}

export function buildPostComposerPickerItems(params: {
  field: PostComposerField;
  value: string;
  lookup: SuggestionLookup;
  refDetails: Record<string, string>;
  limit?: number;
}): SelectionModalItem[] {
  const limit = params.limit ?? 50;
  if (params.field === "severity" || params.field === "blocking" || params.field === "pinned") {
    const options = ["", ...(POST_ENUM_SUGGESTIONS[params.field] ?? [])];
    const labelFor = (value: string) => (value ? value : "(unset)");
    const matches = filterByQuery(
      options.map((value) => labelFor(value)),
      params.value,
      limit
    );
    return matches.map((label) => ({
      value: label === "(unset)" ? "" : label,
      label,
    }));
  }

  if (params.field === "type") {
    return buildItems(filterByQuery(POST_ENUM_SUGGESTIONS.type ?? [], params.value, limit));
  }

  const matches = resolvePostComposerSuggestions(params.field, params.value, params.lookup, limit);
  if (params.field === "refId") {
    return buildItems(matches, (value) =>
      params.refDetails[value] ? `${value} · ${params.refDetails[value]}` : value
    );
  }
  return buildItems(matches);
}

export function buildSubscriptionComposerPickerItems(params: {
  field: SubscriptionComposerField;
  value: string;
  lookup: SuggestionLookup;
  limit?: number;
}): SelectionModalItem[] {
  const limit = params.limit ?? 50;
  if (params.field === "mode") {
    return buildItems(filterByQuery(SUBSCRIPTION_ENUM_SUGGESTIONS.mode ?? [], params.value, limit));
  }
  return buildItems(
    resolveSubscriptionComposerSuggestions(params.field, params.value, params.lookup, limit)
  );
}
