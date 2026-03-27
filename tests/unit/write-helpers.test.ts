import { describe, expect, it } from "vitest";

import { normalizeTags, parseTagInput } from "@/cli/write-helpers.js";

describe("write helpers", () => {
  it("dedupes normalized tags while preserving first-seen casing", () => {
    expect(normalizeTags([" API ", "api", "Frontend", "frontend", "ops"])).toEqual([
      "API",
      "Frontend",
      "ops",
    ]);
  });

  it("dedupes parsed tag input from comma-separated strings", () => {
    expect(parseTagInput("api, frontend, API, frontend, ops")).toEqual(["api", "frontend", "ops"]);
  });
});
