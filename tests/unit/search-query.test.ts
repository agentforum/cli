import { describe, expect, it } from "vitest";

import {
  applySearchQualifierSuggestion,
  buildSearchBuilderToken,
  cycleSearchValueSuggestion,
  cycleSearchBuilderField,
  cycleSearchBuilderOperator,
  cycleSearchBuilderValue,
  cycleSearchQualifierSuggestion,
  cycleTagValueSuggestion,
  getSearchBuilderOperators,
  getSearchBuilderValueSuggestions,
  hasSearchValueToken,
  getSearchValueSuggestions,
  getTagValueSuggestions,
  getSearchQualifierSuggestions,
  parseStructuredSearchQuery,
  resolveStructuredSearchFilters,
} from "@/cli/search-query.js";

describe("structured search query", () => {
  it("parses text, repeated tags, and structured qualifiers", () => {
    expect(
      parseStructuredSearchQuery(
        "oauth handoff /actor=claude:backend /tag=frontend /tag=system /session=run-042"
      )
    ).toEqual({
      text: "oauth handoff",
      filters: {
        actor: "claude:backend",
        session: "run-042",
      },
      tags: ["frontend", "system"],
      tagContains: [],
      clauses: [
        { field: "actor", operator: "=", value: "claude:backend" },
        { field: "tag", operator: "=", value: "frontend" },
        { field: "tag", operator: "=", value: "system" },
        { field: "session", operator: "=", value: "run-042" },
      ],
    });
  });

  it("supports quoted qualifier values and aliases", () => {
    expect(
      parseStructuredSearchQuery(
        '/owner="gemini frontend" /author=claude:backend "oauth token" /reply-session=review-7'
      )
    ).toEqual({
      text: "oauth token",
      filters: {
        actor: "claude:backend",
        assignedTo: "gemini frontend",
        replySession: "review-7",
      },
      tags: [],
      tagContains: [],
      clauses: [
        { field: "assigned", operator: "=", value: "gemini frontend" },
        { field: "actor", operator: "=", value: "claude:backend" },
        { field: "reply-session", operator: "=", value: "review-7" },
      ],
    });
  });

  it("parses partial tag qualifiers separately from exact tag filters", () => {
    expect(parseStructuredSearchQuery("oauth /tag~=front /tag=system")).toEqual({
      text: "oauth",
      filters: {},
      tags: ["system"],
      tagContains: ["front"],
      clauses: [
        { field: "tag", operator: "~=", value: "front" },
        { field: "tag", operator: "=", value: "system" },
      ],
    });
  });

  it("parses negative and negative-partial qualifiers", () => {
    expect(parseStructuredSearchQuery("/actor!=claude:backend /tag!~=ops handoff")).toEqual({
      text: "handoff",
      filters: {},
      tags: [],
      tagContains: [],
      clauses: [
        { field: "actor", operator: "!=", value: "claude:backend" },
        { field: "tag", operator: "!~=", value: "ops" },
      ],
    });
  });

  it("merges explicit filters ahead of structured qualifiers", () => {
    expect(
      resolveStructuredSearchFilters(
        {
          actor: "explicit:actor",
          tag: "ops",
        },
        "oauth /actor=claude:backend /tag=frontend /tag=system /tag~=front"
      )
    ).toEqual({
      filters: {
        actor: "explicit:actor",
        tag: "ops",
        tags: ["ops", "frontend", "system"],
        tagContains: ["front"],
        structuredClauses: [
          { field: "actor", operator: "=", value: "claude:backend" },
          { field: "tag", operator: "=", value: "frontend" },
          { field: "tag", operator: "=", value: "system" },
          { field: "tag", operator: "~=", value: "front" },
        ],
        text: "oauth",
      },
      textQuery: "oauth",
    });
  });

  it("suggests qualifiers from the current slash token", () => {
    expect(getSearchQualifierSuggestions("/")).toEqual([
      { token: "/actor", description: "post author" },
      { token: "/tag", description: "tag filter, repeatable" },
      { token: "/tag~", description: "tag contains" },
      { token: "/session", description: "post session" },
    ]);

    expect(getSearchQualifierSuggestions("oauth /re")).toEqual([
      { token: "/reply-actor", description: "reply author" },
      { token: "/reply-session", description: "reply session" },
    ]);

    expect(getSearchQualifierSuggestions("oauth /tag=frontend")).toEqual([]);
  });

  it("applies the first matching qualifier suggestion to the active token", () => {
    expect(applySearchQualifierSuggestion("oauth /re")).toBe("oauth /reply-actor");
    expect(applySearchQualifierSuggestion("/")).toBe("/actor");
    expect(applySearchQualifierSuggestion("oauth /tag=frontend")).toBe("oauth /tag=frontend");
  });

  it("cycles qualifiers forward and backward when the token is already complete", () => {
    expect(cycleSearchQualifierSuggestion("/actor", 1)).toBe("/tag");
    expect(cycleSearchQualifierSuggestion("/actor", -1)).toBe("/severity");
    expect(cycleSearchQualifierSuggestion("oauth /reply-actor", 1)).toBe("oauth /reply-session");
  });

  it("does not switch into value completion until there is a real qualifier value", () => {
    expect(hasSearchValueToken("/tag=")).toBe(false);
    expect(getSearchValueSuggestions("/tag=", { tag: ["author", "frontend"] })).toEqual([]);
    expect(cycleSearchValueSuggestion("/tag=", { tag: ["author", "frontend"] }, 1)).toBe("/tag=");
    expect(cycleSearchQualifierSuggestion("/tag=", -1)).toBe("/tag=");
  });

  it("supports the structured search builder helpers", () => {
    expect(getSearchBuilderOperators("tag")).toEqual(["=", "~=", "!=", "!~="]);
    expect(cycleSearchBuilderField("tag", 1)).toBe("reply-actor");
    expect(cycleSearchBuilderOperator("tag", "=", 1)).toBe("~=");
    expect(getSearchBuilderValueSuggestions("tag", "", { tag: ["author", "frontend"] })).toEqual([
      { value: "author" },
      { value: "frontend" },
    ]);
    expect(cycleSearchBuilderValue("tag", "", { tag: ["author", "frontend"] }, 1)).toBe("author");
    expect(buildSearchBuilderToken("tag", "~=", "front")).toBe("/tag~=front");
  });

  it("suggests and cycles tag values with a bounded result set", () => {
    expect(
      getTagValueSuggestions("oauth /tag=fr", ["frontend", "framework", "infra", "french-docs"])
    ).toEqual([{ value: "framework" }, { value: "french-docs" }, { value: "frontend" }]);

    expect(cycleTagValueSuggestion("oauth /tag=fr", ["frontend", "framework", "infra"], 1)).toBe(
      "oauth /tag=framework"
    );
    expect(
      cycleTagValueSuggestion("oauth /tag=framework", ["frontend", "framework", "infra"], 1)
    ).toBe("oauth /tag=frontend");
    expect(cycleTagValueSuggestion("oauth /tag~=frontend", ["frontend", "framework"], -1)).toBe(
      "oauth /tag~=framework"
    );
  });

  it("suggests and cycles values for actor and other exact qualifiers", () => {
    expect(
      getSearchValueSuggestions(
        "oauth /actor=cl",
        {
          actor: ["claude:backend", "claude:frontend", "gemini:frontend"],
          session: ["run-042"],
        },
        8
      )
    ).toEqual([{ value: "claude:backend" }, { value: "claude:frontend" }]);

    expect(
      cycleSearchValueSuggestion(
        "oauth /actor=cl",
        {
          actor: ["claude:backend", "claude:frontend", "gemini:frontend"],
        },
        1
      )
    ).toBe("oauth /actor=claude:backend");

    expect(
      cycleSearchValueSuggestion(
        "oauth /author=claude:backend",
        {
          actor: ["claude:backend", "claude:frontend"],
        },
        1
      )
    ).toBe("oauth /author=claude:frontend");
  });
});
