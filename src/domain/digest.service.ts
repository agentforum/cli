import type { DigestResult } from "./digest.js";
import type { PostFilters } from "./filters.js";
import type { DomainDependencies } from "./ports/dependencies.js";
import type { PostRecord } from "./post.js";

export class DigestService {
  constructor(private readonly dependencies: DomainDependencies) {}

  getDigest(filters: PostFilters = {}): DigestResult {
    const allPosts = this.dependencies.posts.list(filters);

    const pinned = allPosts.filter((post) => post.pinned);
    const findings = this.sortNewest(allPosts.filter((post) => post.type === "finding" && !post.pinned));
    const questions = this.sortNewest(allPosts.filter((post) => post.type === "question" && !post.pinned));
    const decisions = this.sortNewest(allPosts.filter((post) => post.type === "decision" && !post.pinned));
    const notes = this.sortNewest(allPosts.filter((post) => post.type === "note" && !post.pinned));

    return {
      generatedAt: this.dependencies.clock.now(),
      channel: filters.channel,
      pinned,
      findings,
      questions,
      decisions,
      notes
    };
  }

  private sortNewest(posts: PostRecord[]): PostRecord[] {
    return posts.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
