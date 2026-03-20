import { describe, expect, it } from "vitest";

import {
  parseLimit,
  parseRefreshMs,
  toOpenBrowseOptions,
} from "../../src/cli/commands/browse/options.js";
import { DEFAULT_REFRESH_MS } from "../../src/cli/commands/browse/types.js";

describe("browse options", () => {
  it("parses the default limit and refresh interval", () => {
    expect(parseLimit()).toBe(30);
    expect(parseRefreshMs()).toBe(DEFAULT_REFRESH_MS);
  });

  it("rejects invalid limit and refresh interval values", () => {
    expect(() => parseLimit("0")).toThrow("--limit must be a positive integer.");
    expect(() => parseRefreshMs("999")).toThrow("--refresh-ms must be an integer >= 1000.");
  });

  it("maps open command options into browse launch options", () => {
    expect(
      toOpenBrowseOptions("P123", {
        actor: "claude:backend",
        session: "run-001",
        text: "oauth",
        autoRefresh: true,
        refreshMs: "5000",
      })
    ).toEqual({
      id: "P123",
      actor: "claude:backend",
      session: "run-001",
      text: "oauth",
      autoRefresh: true,
      refreshMs: "5000",
    });
  });
});
