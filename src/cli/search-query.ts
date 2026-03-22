import type {
  PostFilters,
  StructuredFilterClause,
  StructuredFilterField,
  StructuredFilterOperator,
} from "@/domain/filters.js";

type StructuredFilterKey =
  | "channel"
  | "type"
  | "severity"
  | "status"
  | "actor"
  | "replyActor"
  | "session"
  | "replySession"
  | "assignedTo";

export type SearchClause = StructuredFilterClause;

export interface ParsedSearchQuery {
  text: string;
  filters: Partial<Record<StructuredFilterKey, string>>;
  tags: string[];
  tagContains: string[];
  clauses: SearchClause[];
}

export interface SearchQualifierSuggestion {
  token: string;
  description: string;
}

export interface SearchValueSuggestion {
  value: string;
  description?: string;
}

export interface SearchValueCatalog {
  tag?: string[];
  actor?: string[];
  session?: string[];
  assigned?: string[];
  channel?: string[];
  status?: string[];
  type?: string[];
  severity?: string[];
}

export type SearchBuilderFieldKey = StructuredFilterField;

export type SearchBuilderOperator = StructuredFilterOperator;

export interface SearchBuilderField {
  key: SearchBuilderFieldKey;
  description: string;
  operators: SearchBuilderOperator[];
}

const QUALIFIER_SUGGESTIONS: SearchQualifierSuggestion[] = [
  { token: "/actor", description: "post author" },
  { token: "/tag", description: "tag filter, repeatable" },
  { token: "/tag~", description: "tag contains" },
  { token: "/session", description: "post session" },
  { token: "/assigned", description: "assigned owner" },
  { token: "/reply-actor", description: "reply author" },
  { token: "/reply-session", description: "reply session" },
  { token: "/channel", description: "channel" },
  { token: "/status", description: "status" },
  { token: "/type", description: "post type" },
  { token: "/severity", description: "severity" },
];

export const SEARCH_BUILDER_FIELDS: SearchBuilderField[] = [
  { key: "actor", description: "post author", operators: ["=", "~=", "!=", "!~="] },
  { key: "tag", description: "tag filter, repeatable", operators: ["=", "~=", "!=", "!~="] },
  { key: "reply-actor", description: "reply author", operators: ["=", "~=", "!=", "!~="] },
  { key: "session", description: "post session", operators: ["=", "~=", "!=", "!~="] },
  { key: "reply-session", description: "reply session", operators: ["=", "~=", "!=", "!~="] },
  { key: "assigned", description: "assigned owner", operators: ["=", "~=", "!=", "!~="] },
  { key: "channel", description: "channel", operators: ["=", "~=", "!=", "!~="] },
  { key: "status", description: "status", operators: ["=", "!="] },
  { key: "type", description: "post type", operators: ["=", "!="] },
  { key: "severity", description: "severity", operators: ["=", "!="] },
];

const VALUE_QUALIFIER_ALIASES: Record<string, keyof SearchValueCatalog | null> = {
  actor: "actor",
  author: "actor",
  assigned: "assigned",
  assignee: "assigned",
  channel: "channel",
  owner: "assigned",
  severity: "severity",
  session: "session",
  status: "status",
  tag: "tag",
  "tag~": "tag",
  type: "type",
  "reply-actor": null,
  "reply-session": null,
};

export function parseStructuredSearchQuery(input: string): ParsedSearchQuery {
  const filters: ParsedSearchQuery["filters"] = {};
  const tags: string[] = [];
  const tagContains: string[] = [];
  const clauses: SearchClause[] = [];
  const textTokens: string[] = [];

  for (const token of tokenize(input)) {
    const clause = parseSearchClauseToken(token);
    if (!clause) {
      textTokens.push(token);
      continue;
    }

    clauses.push(clause);

    if (clause.operator === "=") {
      switch (clause.field) {
        case "tag":
          tags.push(clause.value);
          break;
        case "actor":
          filters.actor ??= clause.value;
          break;
        case "reply-actor":
          filters.replyActor ??= clause.value;
          break;
        case "session":
          filters.session ??= clause.value;
          break;
        case "reply-session":
          filters.replySession ??= clause.value;
          break;
        case "assigned":
          filters.assignedTo ??= clause.value;
          break;
        case "channel":
          filters.channel ??= clause.value;
          break;
        case "status":
          filters.status ??= clause.value;
          break;
        case "type":
          filters.type ??= clause.value;
          break;
        case "severity":
          filters.severity ??= clause.value;
          break;
      }
      continue;
    }

    if (clause.field === "tag" && clause.operator === "~=") {
      tagContains.push(clause.value);
    }
  }

  return {
    text: textTokens.join(" ").trim(),
    filters,
    tags,
    tagContains,
    clauses,
  };
}

export function resolveStructuredSearchFilters(
  baseFilters: PostFilters,
  rawQuery?: string
): { filters: PostFilters; textQuery: string } {
  const parsed = parseStructuredSearchQuery(rawQuery ?? "");
  const merged: PostFilters = {
    ...baseFilters,
    channel: baseFilters.channel ?? parsed.filters.channel,
    type: baseFilters.type ?? (parsed.filters.type as PostFilters["type"] | undefined),
    severity:
      baseFilters.severity ?? (parsed.filters.severity as PostFilters["severity"] | undefined),
    status: baseFilters.status ?? (parsed.filters.status as PostFilters["status"] | undefined),
    actor: baseFilters.actor ?? parsed.filters.actor,
    replyActor: baseFilters.replyActor ?? parsed.filters.replyActor,
    session: baseFilters.session ?? parsed.filters.session,
    replySession: baseFilters.replySession ?? parsed.filters.replySession,
    assignedTo: baseFilters.assignedTo ?? parsed.filters.assignedTo,
    text: parsed.text || undefined,
  };

  const tags = [
    ...(baseFilters.tag ? [baseFilters.tag] : []),
    ...(baseFilters.tags ?? []),
    ...parsed.tags,
  ];

  if (tags.length > 0) {
    merged.tags = [...new Set(tags)];
    if (!merged.tag && merged.tags.length === 1) {
      merged.tag = merged.tags[0];
    }
  }

  const tagContains = [...(baseFilters.tagContains ?? []), ...parsed.tagContains];
  if (tagContains.length > 0) {
    merged.tagContains = [...new Set(tagContains)];
  }

  if (parsed.clauses.length > 0) {
    merged.structuredClauses = parsed.clauses;
  }

  return { filters: stripUndefinedFilters(merged), textQuery: parsed.text };
}

export function getSearchQualifierSuggestions(
  input: string,
  limit = 4
): SearchQualifierSuggestion[] {
  const token = currentSearchToken(input);
  if (!token.startsWith("/")) {
    return [];
  }

  if (token.includes("=")) {
    return [];
  }

  const normalized = token.toLowerCase();
  const suggestions =
    normalized === "/"
      ? QUALIFIER_SUGGESTIONS
      : QUALIFIER_SUGGESTIONS.filter((entry) => entry.token.startsWith(normalized));

  return suggestions.slice(0, Math.max(1, limit));
}

export function applySearchQualifierSuggestion(input: string): string {
  const token = currentSearchToken(input);
  const suggestions = getSearchQualifierSuggestions(input, 1);
  const suggestion = suggestions[0];

  if (!token.startsWith("/") || !suggestion) {
    return input;
  }

  const base = input.slice(0, input.length - token.length);
  return `${base}${suggestion.token}`;
}

export function cycleSearchQualifierSuggestion(input: string, direction: 1 | -1): string {
  const token = currentSearchToken(input);
  if (!token.startsWith("/")) {
    return input;
  }

  const exactIndex = QUALIFIER_SUGGESTIONS.findIndex((entry) => entry.token === token);
  if (exactIndex >= 0) {
    const nextIndex =
      (exactIndex + direction + QUALIFIER_SUGGESTIONS.length) % QUALIFIER_SUGGESTIONS.length;
    const base = input.slice(0, input.length - token.length);
    return `${base}${QUALIFIER_SUGGESTIONS[nextIndex].token}`;
  }

  return applySearchQualifierSuggestion(input);
}

export function getTagValueSuggestions(
  input: string,
  availableTags: string[],
  limit = 8
): SearchValueSuggestion[] {
  return getSearchValueSuggestions(input, { tag: availableTags }, limit);
}

export function getSearchBuilderOperators(field: SearchBuilderFieldKey): SearchBuilderOperator[] {
  return SEARCH_BUILDER_FIELDS.find((entry) => entry.key === field)?.operators ?? ["="];
}

export function cycleSearchBuilderField(
  current: SearchBuilderFieldKey,
  direction: 1 | -1
): SearchBuilderFieldKey {
  const currentIndex = SEARCH_BUILDER_FIELDS.findIndex((entry) => entry.key === current);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex =
    (startIndex + direction + SEARCH_BUILDER_FIELDS.length) % SEARCH_BUILDER_FIELDS.length;
  return SEARCH_BUILDER_FIELDS[nextIndex].key;
}

export function cycleSearchBuilderOperator(
  field: SearchBuilderFieldKey,
  current: SearchBuilderOperator,
  direction: 1 | -1
): SearchBuilderOperator {
  const operators = getSearchBuilderOperators(field);
  const currentIndex = operators.indexOf(current);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (startIndex + direction + operators.length) % operators.length;
  return operators[nextIndex];
}

export function getSearchBuilderValueSuggestions(
  field: SearchBuilderFieldKey,
  value: string,
  catalog: SearchValueCatalog,
  limit = 8
): SearchValueSuggestion[] {
  const catalogKey = VALUE_QUALIFIER_ALIASES[field];
  if (!catalogKey) {
    return [];
  }

  const values = [
    ...new Set((catalog[catalogKey] ?? []).map((entry) => entry.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));
  const partial = value.trim().toLowerCase();
  const suggestions = values.filter((entry) =>
    partial.length === 0 ? true : entry.toLowerCase().startsWith(partial)
  );
  return suggestions.slice(0, Math.max(1, limit)).map((entry) => ({ value: entry }));
}

export function cycleSearchBuilderValue(
  field: SearchBuilderFieldKey,
  value: string,
  catalog: SearchValueCatalog,
  direction: 1 | -1,
  limit = 8
): string {
  const suggestions = getSearchBuilderValueSuggestions(field, value, catalog, limit);
  if (suggestions.length === 0) {
    return value;
  }

  const exactIndex = suggestions.findIndex((entry) => entry.value === value.trim());
  const nextIndex =
    exactIndex >= 0
      ? (exactIndex + direction + suggestions.length) % suggestions.length
      : direction === -1
        ? suggestions.length - 1
        : 0;
  return suggestions[nextIndex].value;
}

export function buildSearchBuilderToken(
  field: SearchBuilderFieldKey,
  operator: SearchBuilderOperator,
  value: string
): string {
  return `/${field}${operator}${value.trim()}`;
}

export function cycleTagValueSuggestion(
  input: string,
  availableTags: string[],
  direction: 1 | -1,
  limit = 8
): string {
  return cycleSearchValueSuggestion(input, { tag: availableTags }, direction, limit);
}

export function getSearchValueSuggestions(
  input: string,
  catalog: SearchValueCatalog,
  limit = 8
): SearchValueSuggestion[] {
  const activeValue = currentValueToken(input);
  if (!activeValue || activeValue.value.trim().length === 0) {
    return [];
  }

  const catalogKey = VALUE_QUALIFIER_ALIASES[activeValue.key];
  if (!catalogKey) {
    return [];
  }

  const values = [
    ...new Set((catalog[catalogKey] ?? []).map((value) => value.trim()).filter(Boolean)),
  ].sort((left, right) => left.localeCompare(right));

  const partial = activeValue.value.trim().toLowerCase();
  const suggestions = values.filter((value) =>
    partial.length === 0 ? true : value.toLowerCase().startsWith(partial)
  );

  return suggestions.slice(0, Math.max(1, limit)).map((value) => ({ value }));
}

export function cycleSearchValueSuggestion(
  input: string,
  catalog: SearchValueCatalog,
  direction: 1 | -1,
  limit = 8
): string {
  const activeValue = currentValueToken(input);
  if (!activeValue || activeValue.value.trim().length === 0) {
    return input;
  }

  const catalogKey = VALUE_QUALIFIER_ALIASES[activeValue.key];
  if (!catalogKey) {
    return input;
  }

  const allValues = [
    ...new Set((catalog[catalogKey] ?? []).map((value) => value.trim()).filter(Boolean)),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({ value }));
  const exactValueIndex = allValues.findIndex((entry) => entry.value === activeValue.value.trim());
  const suggestions =
    exactValueIndex >= 0 ? allValues : getSearchValueSuggestions(input, catalog, limit);
  if (suggestions.length === 0) {
    return input;
  }

  const exactIndex = suggestions.findIndex((entry) => entry.value === activeValue.value.trim());
  const nextIndex =
    exactIndex >= 0
      ? (exactIndex + direction + suggestions.length) % suggestions.length
      : direction === -1
        ? suggestions.length - 1
        : 0;
  const base = input.slice(0, input.length - activeValue.token.length);
  return `${base}/${activeValue.key}${activeValue.operator}${suggestions[nextIndex].value}`;
}

export function hasSearchValueToken(input: string): boolean {
  const activeValue = currentValueToken(input);
  return activeValue !== null && activeValue.value.trim().length > 0;
}

function currentValueToken(
  input: string
): { token: string; key: string; operator: SearchBuilderOperator; value: string } | null {
  const token = currentSearchToken(input);
  const match = token.match(/^\/([a-z-]+)(!~=|~=|!=|=)(.*)$/i);
  if (!match) {
    return null;
  }

  const normalizedKey = match[1].trim().toLowerCase();
  if (!(normalizedKey in VALUE_QUALIFIER_ALIASES)) {
    return null;
  }

  return {
    token,
    key: normalizedKey,
    operator: match[2] as SearchBuilderOperator,
    value: match[3],
  };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function currentSearchToken(input: string): string {
  const trimmedRight = input.replace(/\s+$/, "");
  const separatorIndex = Math.max(trimmedRight.lastIndexOf(" "), trimmedRight.lastIndexOf("\t"));
  return separatorIndex >= 0 ? trimmedRight.slice(separatorIndex + 1) : trimmedRight;
}

function stripUndefinedFilters(filters: PostFilters): PostFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined)
  ) as PostFilters;
}

function parseSearchClauseToken(token: string): SearchClause | null {
  const match = token.match(/^\/([a-z-]+)(!~=|~=|!=|=)(.+)$/i);
  if (!match) {
    return null;
  }

  const rawField = match[1].trim().toLowerCase();
  const field = normalizeBuilderField(rawField);
  if (!field) {
    return null;
  }

  const operator = match[2] as SearchBuilderOperator;
  const value = match[3].trim();
  if (!value) {
    return null;
  }

  const supportedOperators = getSearchBuilderOperators(field);
  if (!supportedOperators.includes(operator)) {
    return null;
  }

  return { field, operator, value };
}

function normalizeBuilderField(rawField: string): SearchBuilderFieldKey | null {
  switch (rawField) {
    case "author":
      return "actor";
    case "owner":
    case "assignee":
      return "assigned";
    case "actor":
    case "tag":
    case "reply-actor":
    case "session":
    case "reply-session":
    case "assigned":
    case "channel":
    case "status":
    case "type":
    case "severity":
      return rawField;
    default:
      return null;
  }
}
