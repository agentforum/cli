import { describe, expect, it } from "vitest";

import {
  applyPostComposerSuggestion,
  applySubscriptionComposerSuggestion,
  buildPostComposerPickerItems,
  buildPostComposerSuggestionLookup,
  buildSubscriptionComposerPickerItems,
  resolvePostComposerSuggestions,
  resolveSubscriptionComposerSuggestions,
} from "@/cli/commands/browse/composer-suggestions.js";

describe("browse composer suggestions", () => {
  it("filters post composer suggestions by prefix and substring", () => {
    const lookup = buildPostComposerSuggestionLookup({
      types: ["initiative", "finding", "question"],
      channels: ["backend", "frontend", "ops"],
      actors: ["claude:backend", "claude:frontend"],
      sessions: ["run-001", "run-002"],
      assignedTo: ["claude:frontend"],
      relationTypes: ["relates-to", "blocks"],
      relatedPostIds: ["P1", "P2"],
      tags: ["api", "frontend", "ops"],
    });

    expect(resolvePostComposerSuggestions("channel", "front", lookup)).toEqual(["frontend"]);
    expect(resolvePostComposerSuggestions("actor", "back", lookup)).toEqual(["claude:backend"]);
    expect(resolvePostComposerSuggestions("type", "que", lookup)).toEqual(["question"]);
    expect(resolvePostComposerSuggestions("pinned", "tr", lookup)).toEqual(["true"]);
  });

  it("supports assigned-to suggestions from the broader actor catalog", () => {
    const lookup = buildPostComposerSuggestionLookup({
      types: [],
      channels: [],
      actors: ["claude:backend", "claude:frontend"],
      sessions: [],
      assignedTo: ["gemini:triage"],
      relationTypes: [],
      relatedPostIds: [],
      tags: [],
    });

    expect(resolvePostComposerSuggestions("assignedTo", "back", lookup)).toEqual([
      "claude:backend",
    ]);
    expect(resolvePostComposerSuggestions("assignedTo", "tri", lookup)).toEqual(["gemini:triage"]);
  });

  it("filters tag suggestions from the active comma-separated segment", () => {
    const lookup = buildPostComposerSuggestionLookup({
      types: [],
      channels: [],
      actors: [],
      sessions: [],
      assignedTo: [],
      relationTypes: [],
      relatedPostIds: [],
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

  it("does not add duplicate tags when applying an existing suggestion", () => {
    expect(applyPostComposerSuggestion("tags", "api, fr", "api")).toBe("api");
    expect(applySubscriptionComposerSuggestion("tags", "ops, a", "ops")).toBe("ops");
  });

  it("does not add duplicate tags when the same tag already exists with different casing", () => {
    expect(applyPostComposerSuggestion("tags", "API, fr", "api")).toBe("API");
    expect(applySubscriptionComposerSuggestion("tags", "Ops, a", "ops")).toBe("Ops");
  });

  it("keeps nearby options visible when the picker opens on an exact match", () => {
    const items = buildPostComposerPickerItems({
      field: "type",
      value: "question",
      lookup: {
        type: ["decision", "finding", "initiative", "note", "opportunity", "question", "risk"],
      },
      refDetails: {},
      relationCatalog: [],
      relatedPosts: [],
      exactMatchWindow: true,
      limit: 4,
    });

    expect(items.map((item) => item.value)).toEqual(["note", "opportunity", "question", "risk"]);
  });

  it("matches related posts by id, title, and actor", () => {
    const byTitle = buildPostComposerPickerItems({
      field: "relatedPostId",
      value: "checkout",
      lookup: {},
      refDetails: {},
      relationCatalog: [],
      relatedPosts: [
        { id: "P1", title: "Checkout auth failure", actor: "claude:backend" },
        { id: "P2", title: "Billing retry drift", actor: "claude:ops" },
      ],
      exactMatchWindow: false,
      limit: 10,
    });
    const byActor = buildPostComposerPickerItems({
      field: "relatedPostId",
      value: "ops",
      lookup: {},
      refDetails: {},
      relationCatalog: [],
      relatedPosts: [
        { id: "P1", title: "Checkout auth failure", actor: "claude:backend" },
        { id: "P2", title: "Billing retry drift", actor: "claude:ops" },
      ],
      exactMatchWindow: false,
      limit: 10,
    });

    expect(byTitle.map((item) => item.value)).toEqual(["P1"]);
    expect(byActor.map((item) => item.value)).toEqual(["P2"]);
  });

  it("shows relation descriptions from the catalog", () => {
    const items = buildPostComposerPickerItems({
      field: "relationType",
      value: "block",
      lookup: {},
      refDetails: {},
      relationCatalog: [
        {
          value: "blocks",
          description: "This thread prevents another thread from moving forward.",
        },
      ],
      relatedPosts: [],
      exactMatchWindow: false,
      limit: 10,
    });

    expect(items).toEqual([
      {
        value: "blocks",
        label: "blocks",
        description: "This thread prevents another thread from moving forward.",
      },
    ]);
  });

  it("filters tag picker suggestions from the active comma-separated segment", () => {
    const items = buildPostComposerPickerItems({
      field: "tags",
      value: "api, fr",
      lookup: {
        tags: ["api", "frontend", "ops"],
      },
      refDetails: {},
      relationCatalog: [],
      relatedPosts: [],
      exactMatchWindow: false,
      limit: 5,
    });

    expect(items.map((item) => item.value)).toEqual(["frontend"]);
  });

  it("allows creating a new tag when there is no existing match", () => {
    const items = buildPostComposerPickerItems({
      field: "tags",
      value: "api, fresh-tag",
      lookup: {
        tags: ["api", "frontend", "ops"],
      },
      refDetails: {},
      relationCatalog: [],
      relatedPosts: [],
      exactMatchWindow: false,
      limit: 50,
    });

    expect(items[0]).toEqual({
      value: "fresh-tag",
      label: "fresh-tag",
      description: "Add this new tag.",
      searchText: "fresh-tag",
      synthetic: true,
    });
  });

  it("allows creating new open post field values when there is no existing match", () => {
    expect(
      buildPostComposerPickerItems({
        field: "channel",
        value: "fresh-channel",
        lookup: { channel: ["backend", "frontend"] },
        refDetails: {},
        relationCatalog: [],
        relatedPosts: [],
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "fresh-channel",
      label: "fresh-channel",
      description: "Use this new channel.",
      searchText: "fresh-channel",
      synthetic: true,
    });

    expect(
      buildPostComposerPickerItems({
        field: "type",
        value: "opportunity",
        lookup: { type: ["finding", "question"] },
        refDetails: {},
        relationCatalog: [],
        relatedPosts: [],
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "opportunity",
      label: "opportunity",
      description: "Use this new type.",
      searchText: "opportunity",
      synthetic: true,
    });

    expect(
      buildPostComposerPickerItems({
        field: "actor",
        value: "openclaw:triage",
        lookup: { actor: ["claude:backend"] },
        refDetails: {},
        relationCatalog: [],
        relatedPosts: [],
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "openclaw:triage",
      label: "openclaw:triage",
      description: "Use this actor identity (new).",
      searchText: "openclaw:triage",
      synthetic: true,
    });

    expect(
      buildPostComposerPickerItems({
        field: "session",
        value: "run-xyz",
        lookup: { session: ["run-001"] },
        refDetails: {},
        relationCatalog: [],
        relatedPosts: [],
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "run-xyz",
      label: "run-xyz",
      description: "Use this session value.",
      searchText: "run-xyz",
      synthetic: true,
    });

    expect(
      buildPostComposerPickerItems({
        field: "assignedTo",
        value: "team:review",
        lookup: { assignedTo: ["claude:backend"] },
        refDetails: {},
        relationCatalog: [],
        relatedPosts: [],
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "team:review",
      label: "team:review",
      description: "Assign to this actor (new).",
      searchText: "team:review",
      synthetic: true,
    });

    expect(
      buildPostComposerPickerItems({
        field: "relationType",
        value: "mitigates",
        lookup: {},
        refDetails: {},
        relationCatalog: [{ value: "blocks", description: "This blocks another thread." }],
        relatedPosts: [],
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "mitigates",
      label: "mitigates",
      description: "Use this relation type.",
      searchText: "mitigates",
      synthetic: true,
    });
  });

  it("returns more than one page of tag picker results for client-side paging", () => {
    const items = buildPostComposerPickerItems({
      field: "tags",
      value: "",
      lookup: {
        tags: ["api", "auth", "backend", "billing", "checkout", "frontend", "ops"],
      },
      refDetails: {},
      relationCatalog: [],
      relatedPosts: [],
      exactMatchWindow: false,
      limit: 50,
    });

    expect(items).toHaveLength(7);
    expect(items.map((item) => item.value)).toEqual([
      "api",
      "auth",
      "backend",
      "billing",
      "checkout",
      "frontend",
      "ops",
    ]);
  });

  it("allows creating a new subscription tag when there is no existing match", () => {
    const items = buildSubscriptionComposerPickerItems({
      field: "tags",
      value: "fresh-tag",
      lookup: {
        tags: ["api", "frontend", "ops"],
      },
      exactMatchWindow: false,
      limit: 50,
    });

    expect(items[0]).toEqual({
      value: "fresh-tag",
      label: "fresh-tag",
      description: "Add this new tag.",
      searchText: "fresh-tag",
      synthetic: true,
    });
  });

  it("allows creating new open subscription field values when there is no existing match", () => {
    expect(
      buildSubscriptionComposerPickerItems({
        field: "channel",
        value: "fresh-channel",
        lookup: {
          channel: ["backend", "frontend"],
        },
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "fresh-channel",
      label: "fresh-channel",
      description: "Use this new channel.",
      searchText: "fresh-channel",
      synthetic: true,
    });

    expect(
      buildSubscriptionComposerPickerItems({
        field: "actor",
        value: "openclaw:triage",
        lookup: {
          actor: ["claude:backend"],
        },
        exactMatchWindow: false,
        limit: 50,
      })[0]
    ).toEqual({
      value: "openclaw:triage",
      label: "openclaw:triage",
      description: "Use this actor identity (new).",
      searchText: "openclaw:triage",
      synthetic: true,
    });
  });
});
