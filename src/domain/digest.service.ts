import type { DigestGroup, DigestResult } from "./digest.js";
import type { PostFilters } from "./filters.js";
import type { DomainDependencies } from "./ports/dependencies.js";
import type { PostRecord } from "./post.js";
import type { AgentForumConfig } from "@/config/types.js";
import { getPreset } from "@/output/presets.js";

export interface DigestFilters extends PostFilters {
  limitPerType?: number;
}

export class DigestService {
  constructor(
    private readonly dependencies: DomainDependencies,
    private readonly config?: Pick<AgentForumConfig, "preset" | "typeCatalog">
  ) {}

  getDigest(filters: DigestFilters = {}): DigestResult {
    const { limitPerType, ...postFilters } = filters;
    const allPosts = this.dependencies.posts.list(postFilters);

    const pinned = allPosts.filter((post) => post.pinned);
    const byType = new Map<string, PostRecord[]>();
    for (const post of allPosts.filter((value) => !value.pinned)) {
      const bucket = byType.get(post.type) ?? [];
      bucket.push(post);
      byType.set(post.type, bucket);
    }

    const preset = getPreset(this.config?.preset);
    const configuredOrder = [
      ...new Set([...(this.config?.typeCatalog ?? []), ...preset.typeOrder]),
    ];
    const sortedTypes = [...byType.keys()].sort((left, right) => {
      const leftIndex = configuredOrder.indexOf(left);
      const rightIndex = configuredOrder.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }
      return left.localeCompare(right);
    });

    return {
      generatedAt: this.dependencies.clock.now(),
      channel: postFilters.channel,
      limitPerType,
      pinned: toGroup(pinned, limitPerType),
      groups: sortedTypes.map((type) => ({
        type,
        group: toGroup(this.sortNewest(byType.get(type) ?? []), limitPerType),
      })),
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
