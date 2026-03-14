import type { PostRecord } from "./post.js";

export interface DigestResult {
  generatedAt: string;
  channel?: string;
  pinned: PostRecord[];
  findings: PostRecord[];
  questions: PostRecord[];
  decisions: PostRecord[];
  notes: PostRecord[];
}
