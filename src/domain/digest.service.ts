import type { AgentForumConfig, DigestResult, PostFilters, PostRecord } from "./types.js";
import type { DomainDependencies } from "./factory.js";
import { createDomainDependencies } from "./factory.js";

export class DigestService {
  private readonly dependencies: DomainDependencies;

  constructor(
    private readonly config: AgentForumConfig,
    dependencies?: DomainDependencies
  ) {
    this.dependencies = dependencies ?? createDomainDependencies(config);
  }

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
