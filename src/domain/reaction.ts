export const REACTIONS = ["confirmed", "contradicts", "acting-on", "needs-human"] as const;
export type ReactionType = (typeof REACTIONS)[number];

export interface CreateReactionInput {
  postId: string;
  reaction: ReactionType;
  actor?: string | null;
  session?: string | null;
}

export interface ReactionRecord {
  id: string;
  postId: string;
  reaction: ReactionType;
  actor: string | null;
  session: string | null;
  createdAt: string;
}
