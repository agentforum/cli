import { describe, expect, it } from "vitest";

import {
  MAX_SEARCH_QUERY_LENGTH,
  appendSearchQuery,
  buildInputViewport,
  consumeOpenSearchShortcut,
  deleteSearchQueryBackward,
  sanitizeSearchInput,
} from "@/cli/commands/browse/search-input.js";

describe("browse search input", () => {
  it("sanitizes control characters and preserves visible text", () => {
    expect(sanitizeSearchInput("oauth\n\trefresh\u001Btoken")).toBe("oauthrefreshtoken");
  });

  it("clamps appended text to the maximum query length", () => {
    const current = "x".repeat(MAX_SEARCH_QUERY_LENGTH - 2);
    expect(appendSearchQuery(current, "token")).toBe(`${current}to`);
  });

  it("removes a full unicode code point on backspace", () => {
    expect(deleteSearchQueryBackward("token😀")).toBe("token");
  });

  it("consumes the leading slash used to open the search modal", () => {
    expect(consumeOpenSearchShortcut("/oauth", "/")).toBe("oauth");
    expect(consumeOpenSearchShortcut("oauth", "/")).toBe("oauth");
  });

  it("builds a trailing viewport for long queries", () => {
    expect(
      buildInputViewport({
        value: "oauth token rotation rollback",
        placeholder: "search title, body, author, replies",
        visibleWidth: 12,
      })
    ).toEqual({
      text: "\u2026on rollback",
      isPlaceholder: false,
      isClipped: true,
    });
  });

  it("uses a clipped placeholder when the field is empty", () => {
    expect(
      buildInputViewport({
        value: "",
        placeholder: "search title, body, author, replies",
        visibleWidth: 10,
      })
    ).toEqual({
      text: "search tit",
      isPlaceholder: true,
      isClipped: true,
    });
  });
});
