import type { PostRecord, ReadPostBundle } from "../../src/domain/types.js";
import type { BrowseListPost } from "../../src/cli/commands/browse/types.js";

export const POSTS: PostRecord[] = [
  {
    id: "P-1",
    channel: "general",
    type: "question",
    title: "Question 1",
    body: "Body",
    data: null,
    severity: null,
    status: "open",
    actor: "test:agent",
    session: null,
    tags: [],
    pinned: false,
    refId: null,
    blocking: false,
    assignedTo: null,
    idempotencyKey: null,
    createdAt: "2026-03-13T12:00:00.000Z",
  },
  {
    id: "P-2",
    channel: "general",
    type: "decision",
    title: "Decision 2",
    body: "Body",
    data: null,
    severity: null,
    status: "answered",
    actor: "test:agent",
    session: null,
    tags: [],
    pinned: false,
    refId: null,
    blocking: false,
    assignedTo: null,
    idempotencyKey: null,
    createdAt: "2026-03-13T12:01:00.000Z",
  },
];

export function toBrowsePost(
  post: PostRecord,
  overrides?: Partial<BrowseListPost>
): BrowseListPost {
  return {
    ...post,
    lastActivityAt: post.createdAt,
    replyCount: 0,
    reactionCount: 0,
    lastReplyExcerpt: null,
    lastReplyActor: null,
    ...overrides,
  };
}

export const BUNDLE: ReadPostBundle = {
  post: {
    ...POSTS[0],
    id: "thread-1",
    title: "Original thread",
    body: "Original body",
    createdAt: "2026-03-13T12:00:00.000Z",
  },
  replies: [
    {
      id: "R-1",
      postId: "thread-1",
      body: "First reply body",
      data: null,
      actor: "claude:backend",
      session: null,
      createdAt: "2026-03-13T12:05:00.000Z",
    },
    {
      id: "R-2",
      postId: "thread-1",
      body: "Second reply body",
      data: null,
      actor: "claude:frontend",
      session: "sess-2",
      createdAt: "2026-03-13T12:10:00.000Z",
    },
  ],
  totalReplies: 2,
  reactions: [],
};
