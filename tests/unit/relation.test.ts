import { describe, expect, it } from "vitest";

import { normalizeRelationCatalog, normalizeRelationCatalogEntries } from "@/domain/relation.js";

describe("relation catalog normalization", () => {
  it("keeps built-in descriptions and accepts described overrides", () => {
    const entries = normalizeRelationCatalogEntries([
      "blocks",
      { value: "caused-by", description: "Custom explanation." },
      { value: "triaged-by", description: "Marked as triaged by another thread." },
    ]);

    expect(entries.find((entry) => entry.value === "blocks")?.description).toBeTruthy();
    expect(entries.find((entry) => entry.value === "caused-by")?.description).toBe(
      "Custom explanation."
    );
    expect(entries.find((entry) => entry.value === "triaged-by")).toEqual({
      value: "triaged-by",
      description: "Marked as triaged by another thread.",
    });
  });

  it("exposes the normalized relation type values for validation", () => {
    expect(normalizeRelationCatalog([{ value: "triaged-by" }])).toContain("triaged-by");
    expect(normalizeRelationCatalog([{ value: "blocks" }])).toContain("blocks");
  });
});
