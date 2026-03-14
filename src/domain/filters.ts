import type { ReactionType } from "./reaction.js";
import type { PostStatus, PostType, Severity } from "./post.js";

export interface PostFilters {
  channel?: string;
  type?: PostType;
  severity?: Severity;
  status?: PostStatus;
  tag?: string;
  actor?: string;
  session?: string;
  since?: string;
  pinned?: boolean;
  reaction?: ReactionType;
  limit?: number;
  afterId?: string;
  unreadForSession?: string;
  subscribedForActor?: string;
  assignedTo?: string;
  waitingForActor?: string;
}
