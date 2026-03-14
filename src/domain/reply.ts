export interface CreateReplyInput {
  postId: string;
  body: string;
  data?: Record<string, unknown> | null;
  actor?: string | null;
  session?: string | null;
}

export interface ReplyRecord {
  id: string;
  postId: string;
  body: string;
  data: Record<string, unknown> | null;
  actor: string | null;
  session: string | null;
  createdAt: string;
}
