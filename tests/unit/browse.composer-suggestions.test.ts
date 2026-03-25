import { describe, expect, it } from "vitest";

import {
  applyPostComposerSuggestion,
  applySubscriptionComposerSuggestion,
  buildPostComposerSuggestionLookup,
  resolvePostComposerSuggestions,
  resolveSubscriptionComposerSuggestions,
} from "@/cli/commands/browse/composer-suggestions.js";

describe("browse composer suggestions", () => {
  it("filters post composer suggestions by prefix and substring", () => {
    const lookup = buildPostComposerSuggestionLookup({
      channels: ["backend", "frontend", "ops"],
      actors: ["claude:backend", "claude:frontend"],
      sessions: ["run-001", "run-002"],
      assignedTo: ["claude:frontend"],
      refIds: ["P1", "P2"],
      tags: ["api", "frontend", "ops"],
    });

    expect(resolvePostComposerSuggestions("channel", "front", lookup)).toEqual(["frontend"]);
    expect(resolvePostComposerSuggestions("actor", "back", lookup)).toEqual(["claude:backend"]);
    expect(resolvePostComposerSuggestions("type", "que", lookup)).toEqual(["question"]);
    expect(resolvePostComposerSuggestions("pinned", "tr", lookup)).toEqual(["true"]);
  });

  it("filters tag suggestions from the active comma-separated segment", () => {
    const lookup = buildPostComposerSuggestionLookup({
      channels: [],
      actors: [],
      sessions: [],
      assignedTo: [],
      refIds: [],
      tags: ["api", "frontend", "ops"],
    });

    expect(resolvePostComposerSuggestions("tags", "api, fr", lookup)).toEqual(["frontend"]);
  });

  it("filters subscription suggestions from known values", () => {
    const lookup = {
      actor: ["claude:backend", "claude:frontend"],
      channel: ["backend", "frontend"],
      tags: ["api", "ops"],
    };

    expect(resolveSubscriptionComposerSuggestions("channel", "back", lookup)).toEqual(["backend"]);
    expect(resolveSubscriptionComposerSuggestions("tags", "a", lookup)).toEqual(["api"]);
    expect(resolveSubscriptionComposerSuggestions("mode", "sub", lookup)).toEqual([
      "subscribe",
      "unsubscribe",
    ]);
  });

  it("applies tag suggestions to the active comma-separated segment", () => {
    expect(applyPostComposerSuggestion("tags", "api, fr", "frontend")).toBe("api, frontend");
    expect(applySubscriptionComposerSuggestion("tags", "ops, a", "api")).toBe("ops, api");
  });
});
