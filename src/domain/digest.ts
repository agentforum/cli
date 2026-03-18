import type { PostRecord } from "./post.js";

export interface DigestGroupSummary {
  total: number;
  shown: number;
}

export interface DigestGroup {
  items: PostRecord[];
  summary: DigestGroupSummary;
}

export interface DigestResult {
  generatedAt: string;
  channel?: string;
  limitPerType?: number;
  pinned: DigestGroup;
  findings: DigestGroup;
  questions: DigestGroup;
  decisions: DigestGroup;
  notes: DigestGroup;
}
