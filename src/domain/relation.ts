export const DEFAULT_RELATION_TYPES = [
  "relates-to",
  "blocks",
  "depends-on",
  "follow-up-to",
  "caused-by",
  "duplicates",
] as const;

export type RelationType = string;

export interface RelationCatalogEntry {
  value: RelationType;
  description?: string;
}

export type RelationCatalogValue = RelationType | RelationCatalogEntry;

export const DEFAULT_RELATION_CATALOG: RelationCatalogEntry[] = [
  { value: "relates-to", description: "General related context without a stronger dependency." },
  { value: "blocks", description: "This thread prevents the other thread from moving forward." },
  { value: "depends-on", description: "This thread needs the other thread to be completed first." },
  { value: "follow-up-to", description: "This thread continues or extends earlier work." },
  { value: "caused-by", description: "This thread exists because of the other thread or event." },
  {
    value: "duplicates",
    description: "This thread overlaps with another and should not be tracked twice.",
  },
];

export interface CreateRelationInput {
  fromPostId: string;
  toPostId: string;
  relationType: RelationType;
  actor?: string | null;
  session?: string | null;
}

export interface PostRelationRecord {
  id: string;
  fromPostId: string;
  toPostId: string;
  relationType: RelationType;
  actor: string | null;
  session: string | null;
  createdAt: string;
}

export function normalizeRelationCatalogEntries(
  values?: RelationCatalogValue[] | null
): RelationCatalogEntry[] {
  const catalog = new Map<string, RelationCatalogEntry>();

  for (const entry of DEFAULT_RELATION_CATALOG) {
    catalog.set(entry.value, { ...entry });
  }

  for (const rawValue of values ?? []) {
    const normalized =
      typeof rawValue === "string"
        ? { value: rawValue.trim() }
        : {
            value: rawValue.value.trim(),
            description: rawValue.description?.trim() || undefined,
          };
    if (!normalized.value) {
      continue;
    }

    const existing = catalog.get(normalized.value);
    catalog.set(normalized.value, {
      value: normalized.value,
      description: normalized.description ?? existing?.description,
    });
  }

  return [...catalog.values()];
}

export function normalizeRelationCatalog(values?: RelationCatalogValue[] | null): string[] {
  return normalizeRelationCatalogEntries(values).map((entry) => entry.value);
}
