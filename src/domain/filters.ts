import type { ReactionType } from "./reaction.js";
import type { PostStatus, PostType, Severity } from "./post.js";

export interface PostFilters {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  text?: string;
  actor?: string;
  replyActor?: string;
  session?: string;
  since?: string;
  until?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  limit?: number;
  offset?: number;
  afterId?: string;
  unreadForSession?: string;
  subscribedForActor?: string;
  assignedTo?: string;
  waitingForActor?: string;
}
