export const DEFAULT_REACTIONS = ["confirmed", "contradicts", "acting-on", "needs-human"] as const;
export const REACTIONS = DEFAULT_REACTIONS;
export type ReactionType = string;
export const REACTION_TARGET_TYPES = ["post", "reply"] as const;
export type ReactionTargetType = (typeof REACTION_TARGET_TYPES)[number];

export function normalizeReactionCatalog(values?: string[] | null): string[] {
  const normalized = (values ?? []).map((value) => value.trim()).filter(Boolean);

  if (normalized.length === 0) {
    return [...DEFAULT_REACTIONS];
  }

  return [...new Set(normalized)];
}

export interface CreateReactionInput {
  targetId: string;
  reaction: ReactionType;
  targetType?: ReactionTargetType | null;
  actor?: string | null;
  session?: string | null;
}

export interface ReactionRecord {
  id: string;
  postId: string;
  targetType: ReactionTargetType;
  targetId: string;
  reaction: ReactionType;
  actor: string | null;
  session: string | null;
  createdAt: string;
}
