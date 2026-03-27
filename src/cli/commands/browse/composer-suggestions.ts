import type { RelationCatalogEntry } from "@/domain/relation.js";
import type { PostComposerField, SelectionModalItem, SubscriptionComposerField } from "./types.js";

type SuggestionLookup = Partial<Record<string, string[]>>;
const POST_ENUM_SUGGESTIONS: Partial<Record<PostComposerField, string[]>> = {
  severity: ["critical", "warning", "info"],
  blocking: ["true", "false"],
  pinned: ["true", "false"],
};
const SUBSCRIPTION_ENUM_SUGGESTIONS: Partial<Record<SubscriptionComposerField, string[]>> = {
  mode: ["subscribe", "unsubscribe"],
};

export function isPostComposerDynamicPickerField(field: PostComposerField): boolean {
  return (
    field === "channel" ||
    field === "type" ||
    field === "tags" ||
    field === "actor" ||
    field === "session" ||
    field === "relatedPostId" ||
    field === "assignedTo"
  );
}

export function isSubscriptionComposerDynamicPickerField(
  field: SubscriptionComposerField
): boolean {
  return field === "actor" || field === "channel" || field === "tags";
}

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
    field === "relationType" ||
    field === "relatedPostId" ||
    field === "blocking" ||
    field === "pinned" ||
    field === "assignedTo"
  );
}

export function isSubscriptionComposerPickerField(field: SubscriptionComposerField): boolean {
  return field === "mode" || field === "actor" || field === "channel" || field === "tags";
}

function resolvePostComposerFreeTextFallback(
  field: PostComposerField,
  query: string
): { label: string; description: string } | null {
  const value = query.trim();
  if (!value) {
    return null;
  }

  switch (field) {
    case "channel":
      return { label: value, description: "Use this new channel." };
    case "type":
      return { label: value, description: "Use this new type." };
    case "tags":
      return { label: value, description: "Add this new tag." };
    case "actor":
      return { label: value, description: "Use this actor identity (new)." };
    case "session":
      return { label: value, description: "Use this session value." };
    case "assignedTo":
      return { label: value, description: "Assign to this actor (new)." };
    case "relationType":
      return { label: value, description: "Use this relation type." };
    default:
      return null;
  }
}

function resolveSubscriptionComposerFreeTextFallback(
  field: SubscriptionComposerField,
  query: string
): { label: string; description: string } | null {
  const value = query.trim();
  if (!value) {
    return null;
  }

  switch (field) {
    case "channel":
      return { label: value, description: "Use this new channel." };
    case "actor":
      return { label: value, description: "Use this actor identity (new)." };
    case "tags":
      return { label: value, description: "Add this new tag." };
    default:
      return null;
  }
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

function normalizeItemSearchText(item: SelectionModalItem): string {
  return [item.value, item.label, item.description, item.searchText]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

function prependCustomValueOption(
  items: SelectionModalItem[],
  value: string,
  options: { label: string; description?: string }
): SelectionModalItem[] {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return items;
  }
  if (items.length > 0) {
    return items;
  }

  const alreadyExists = items.some(
    (item) => item.value.trim().toLocaleLowerCase() === normalizedValue.toLocaleLowerCase()
  );
  if (alreadyExists) {
    return items;
  }

  return [
    {
      value: normalizedValue,
      label: options.label,
      description: options.description,
      searchText: normalizedValue,
      synthetic: true,
    },
    ...items,
  ];
}

function filterSelectionItems(
  items: SelectionModalItem[],
  query: string,
  limit: number,
  options?: {
    exactMatchWindow?: boolean;
  }
): SelectionModalItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return items.slice(0, limit);
  }

  const exactIndex = items.findIndex((item) =>
    [item.value, item.label, item.searchText]
      .filter(Boolean)
      .map((value) => value!.trim().toLocaleLowerCase())
      .includes(normalizedQuery)
  );
  if (options?.exactMatchWindow && exactIndex >= 0) {
    const start = Math.max(0, Math.min(exactIndex, Math.max(0, items.length - limit)));
    const end = Math.min(items.length, start + limit);
    return items.slice(start, end);
  }

  return items
    .filter((item) => normalizeItemSearchText(item).includes(normalizedQuery))
    .sort((left, right) => {
      const leftText = normalizeItemSearchText(left);
      const rightText = normalizeItemSearchText(right);
      const leftStarts = leftText.startsWith(normalizedQuery) ? 0 : 1;
      const rightStarts = rightText.startsWith(normalizedQuery) ? 0 : 1;
      if (leftStarts !== rightStarts) {
        return leftStarts - rightStarts;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

export function buildPostComposerSuggestionLookup(values: {
  types: string[];
  channels: string[];
  actors: string[];
  sessions: string[];
  assignedTo: string[];
  relationTypes: string[];
  relatedPostIds: string[];
  tags: string[];
}): SuggestionLookup {
  return {
    type: uniqueSorted(values.types),
    channel: uniqueSorted(values.channels),
    actor: uniqueSorted(values.actors),
    session: uniqueSorted(values.sessions),
    assignedTo: uniqueSorted([...values.actors, ...values.assignedTo]),
    relationType: uniqueSorted(values.relationTypes),
    relatedPostId: uniqueSorted(values.relatedPostIds),
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

  return applyTagSuggestion(currentValue, suggestion);
}

export function applySubscriptionComposerSuggestion(
  field: SubscriptionComposerField,
  currentValue: string,
  suggestion: string
): string {
  if (field !== "tags") {
    return suggestion;
  }

  return applyTagSuggestion(currentValue, suggestion);
}

function applyTagSuggestion(currentValue: string, suggestion: string): string {
  const normalizedSuggestion = suggestion.trim();
  if (!normalizedSuggestion) {
    return currentValue;
  }

  const parts = currentValue.split(",");
  if (parts.length === 0) {
    return normalizedSuggestion;
  }

  const existingTags = parts
    .slice(0, -1)
    .map((part) => part.trim())
    .filter(Boolean);

  const alreadyExists = existingTags.some(
    (tag) => tag.toLocaleLowerCase() === normalizedSuggestion.toLocaleLowerCase()
  );

  const nextTags = alreadyExists ? existingTags : [...existingTags, normalizedSuggestion];

  return nextTags.join(", ");
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
  relationCatalog: RelationCatalogEntry[];
  relatedPosts: Array<{
    id: string;
    title: string;
    actor: string | null;
  }>;
  exactMatchWindow?: boolean;
  limit?: number;
}): SelectionModalItem[] {
  const limit = params.limit ?? 50;
  const pickerQuery =
    params.field === "tags" ? (params.value.split(",").at(-1)?.trim() ?? "") : params.value;
  const effectiveLimit = limit;
  if (params.field === "severity" || params.field === "blocking" || params.field === "pinned") {
    const options = ["", ...(POST_ENUM_SUGGESTIONS[params.field] ?? [])].map((value) => ({
      value,
      label: value || "(unset)",
    }));
    return filterSelectionItems(options, pickerQuery, effectiveLimit, {
      exactMatchWindow: params.exactMatchWindow,
    });
  }

  if (params.field === "type") {
    const filteredItems = filterSelectionItems(
      buildItems(params.lookup.type ?? []),
      pickerQuery,
      effectiveLimit,
      {
        exactMatchWindow: params.exactMatchWindow,
      }
    );
    const freeTextFallback = resolvePostComposerFreeTextFallback(params.field, pickerQuery);
    return freeTextFallback
      ? prependCustomValueOption(filteredItems, pickerQuery, freeTextFallback)
      : filteredItems;
  }

  if (params.field === "relationType") {
    const filteredItems = filterSelectionItems(
      params.relationCatalog.map((entry) => ({
        value: entry.value,
        label: entry.value,
        description: entry.description,
      })),
      pickerQuery,
      effectiveLimit,
      {
        exactMatchWindow: params.exactMatchWindow,
      }
    );
    const freeTextFallback = resolvePostComposerFreeTextFallback(params.field, pickerQuery);
    return freeTextFallback
      ? prependCustomValueOption(filteredItems, pickerQuery, freeTextFallback)
      : filteredItems;
  }

  if (params.field === "relatedPostId") {
    return filterSelectionItems(
      params.relatedPosts.map((post) => {
        const detailParts = [post.title.trim(), post.actor ? `@${post.actor}` : null].filter(
          Boolean
        );
        return {
          value: post.id,
          label: detailParts.length > 0 ? `${post.id} · ${detailParts.join(" · ")}` : post.id,
          description: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
          searchText: [post.id, post.title, post.actor ?? ""].join(" "),
        };
      }),
      pickerQuery,
      effectiveLimit,
      {
        exactMatchWindow: params.exactMatchWindow,
      }
    );
  }

  const items = buildItems(params.lookup[params.field] ?? []);
  const filteredItems = filterSelectionItems(items, pickerQuery, effectiveLimit, {
    exactMatchWindow: params.exactMatchWindow,
  });
  const freeTextFallback = resolvePostComposerFreeTextFallback(params.field, pickerQuery);
  return freeTextFallback
    ? prependCustomValueOption(filteredItems, pickerQuery, freeTextFallback)
    : filteredItems;
}

export function buildSubscriptionComposerPickerItems(params: {
  field: SubscriptionComposerField;
  value: string;
  lookup: SuggestionLookup;
  exactMatchWindow?: boolean;
  limit?: number;
}): SelectionModalItem[] {
  const limit = params.limit ?? 50;
  const pickerQuery =
    params.field === "tags" ? (params.value.split(",").at(-1)?.trim() ?? "") : params.value;
  const effectiveLimit = limit;
  if (params.field === "mode") {
    return filterSelectionItems(
      buildItems(SUBSCRIPTION_ENUM_SUGGESTIONS.mode ?? []),
      params.value,
      effectiveLimit,
      { exactMatchWindow: params.exactMatchWindow }
    );
  }
  const filteredItems = filterSelectionItems(
    buildItems(params.lookup[params.field] ?? []),
    pickerQuery,
    effectiveLimit,
    {
      exactMatchWindow: params.exactMatchWindow,
    }
  );
  const freeTextFallback = resolveSubscriptionComposerFreeTextFallback(params.field, pickerQuery);
  return freeTextFallback
    ? prependCustomValueOption(filteredItems, pickerQuery, freeTextFallback)
    : filteredItems;
}
