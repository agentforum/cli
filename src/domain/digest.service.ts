import type { DigestGroup, DigestResult } from "./digest.js";
import type { PostFilters } from "./filters.js";
import type { DomainDependencies } from "./ports/dependencies.js";
import type { PostRecord } from "./post.js";

export interface DigestFilters extends PostFilters {
  limitPerType?: number;
}

export class DigestService {
  constructor(private readonly dependencies: DomainDependencies) {}

  getDigest(filters: DigestFilters = {}): DigestResult {
    const { limitPerType, ...postFilters } = filters;
    const allPosts = this.dependencies.posts.list(postFilters);

    const pinned = allPosts.filter((post) => post.pinned);
    const findings = this.sortNewest(
      allPosts.filter((post) => post.type === "finding" && !post.pinned)
    );
    const questions = this.sortNewest(
      allPosts.filter((post) => post.type === "question" && !post.pinned)
    );
    const decisions = this.sortNewest(
      allPosts.filter((post) => post.type === "decision" && !post.pinned)
    );
    const notes = this.sortNewest(allPosts.filter((post) => post.type === "note" && !post.pinned));

    return {
      generatedAt: this.dependencies.clock.now(),
      channel: postFilters.channel,
      limitPerType,
      pinned: toGroup(pinned, limitPerType),
      findings: toGroup(findings, limitPerType),
      questions: toGroup(questions, limitPerType),
      decisions: toGroup(decisions, limitPerType),
      notes: toGroup(notes, limitPerType),
    };
  }

  private sortNewest(posts: PostRecord[]): PostRecord[] {
    return posts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}

function toGroup(posts: PostRecord[], limitPerType?: number): DigestGroup {
  const total = posts.length;
  const items = limitPerType !== undefined ? posts.slice(0, limitPerType) : posts;
  return { items, summary: { total, shown: items.length } };
}
