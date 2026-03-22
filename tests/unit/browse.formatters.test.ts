import { describe, expect, it } from "vitest";

import {
  buildAutoRefreshLabel,
  buildBrowseHint,
  buildFilterSummary,
  buildPageLabel,
  buildReadProgressLabel,
  describeSearchMatchKind,
  describeConversationFilterMode,
  describeConversationSortMode,
  describeRefreshMs,
  describeSortMode,
  estimateTokenCount,
  excerpt,
  excerptAroundMatch,
  sanitizeTerminalText,
  splitHighlightedText,
  statusIcon,
  summarizeReactions,
  timeAgo,
} from "@/cli/commands/browse/formatters.js";

describe("browse formatters", () => {
  it("builds readable filter summaries", () => {
    expect(
      buildFilterSummary(
        { channel: "general", type: "question", status: "open", assignedTo: "claude:backend" },
        12,
        {
          autoRefreshEnabled: true,
          refreshMs: 5000,
          lastRefreshAt: "12:30:10",
          sortMode: "activity",
        }
      )
    ).toContain("auto: on (5s)");
    expect(
      buildFilterSummary(
        { channel: "general", type: "question", status: "open", assignedTo: "claude:backend" },
        12,
        {
          autoRefreshEnabled: true,
          refreshMs: 5000,
          lastRefreshAt: "12:30:10",
          sortMode: "activity",
        }
      )
    ).toContain("sort: last activity");
  });

  it("builds contextual hints per view", () => {
    expect(buildBrowseHint("list", 5)).toContain("Enter open");
    expect(buildBrowseHint("list", 5)).toContain("PgUp/PgDn");
    expect(buildBrowseHint("list", 5)).toContain("Esc channels");
    expect(buildBrowseHint("list", 0)).not.toContain("Enter");
    expect(buildBrowseHint("post", 5)).toContain("PgUp/PgDn");
    expect(buildBrowseHint("post", 5)).toContain("e react");
    expect(buildBrowseHint("post", 5)).toContain("r reply");
    expect(buildBrowseHint("post", 5)).toContain("w toggle quote");
    expect(buildBrowseHint("post", 5)).not.toContain("[ ] pages");
    expect(buildBrowseHint("reader", 5)).toContain("PgUp/PgDn fast scroll");
    expect(buildBrowseHint("reader", 5)).toContain("j/k");
    expect(buildBrowseHint("reader", 5)).toContain("e react");
    expect(buildBrowseHint("reply", 5)).toContain("Ctrl+S");
    expect(buildBrowseHint("reply", 5)).toContain("Tab/Shift+Tab");
    expect(buildBrowseHint("channels", 5)).toContain("Esc/Tab");
  });

  it("formats time, labels, and status helpers", () => {
    const now = new Date("2026-03-13T14:00:00.000Z");
    expect(describeRefreshMs(5000)).toBe("5s");
    expect(describeRefreshMs(1500)).toBe("2s");
    expect(buildAutoRefreshLabel(true, 5000, 3000)).toBe("auto 5s  |  next 3s");
    expect(buildAutoRefreshLabel(false, 5000, 3000)).toBe("auto off");
    expect(describeSortMode("channel")).toBe("channel (A-Z)");
    expect(describeConversationFilterMode("replies")).toBe("replies");
    expect(describeConversationSortMode("recent")).toBe("newest first");
    expect(timeAgo("2026-03-13T13:55:00.000Z", now)).toBe("5m ago");
    expect(timeAgo("2026-03-10T14:00:00.000Z", now)).toBe("3d ago");
    expect(timeAgo("2026-03-01T14:00:00.000Z", now)).toBe("Mar 1");
    expect(statusIcon("answered")).toBe("\u2713");
    expect(buildPageLabel(2, 4, 31, 60, 120)).toContain("page 2/4");
    expect(estimateTokenCount("abcd".repeat(10))).toBe(10);
  });

  it("builds read progress labels", () => {
    expect(buildReadProgressLabel(0, 0, 0)).toBe("[100% read]");
    expect(buildReadProgressLabel(0, 200, 100)).toBe("[0% read]");
    expect(buildReadProgressLabel(50, 200, 100)).toBe("[50% read]");
  });

  it("truncates and sanitizes terminal text", () => {
    expect(excerpt("line one\nline two")).toBe("line one line two");
    expect(excerpt("toolong", 5)).toBe("tool\u2026");
    expect(excerptAroundMatch("before token refresh after", "token", 14)).toContain("token");
    expect(sanitizeTerminalText("🟢 ALLOW\n🔴 DENY")).toBe("[green] ALLOW\n[red] DENY");
    expect(sanitizeTerminalText("Política\tválida")).toBe("Política  válida");
    expect(sanitizeTerminalText("ok 😀")).toBe("ok [?]");
  });

  it("builds search labels and highlighted segments", () => {
    expect(describeSearchMatchKind("reply-author")).toBe("R.AUTHOR");
    expect(describeSearchMatchKind("tag")).toBe("TAG");
    expect(describeSearchMatchKind("session")).toBe("SESSION");
    expect(splitHighlightedText("OAuth Token Rotation", "token")).toEqual([
      { text: "OAuth ", match: false },
      { text: "Token", match: true },
      { text: " Rotation", match: false },
    ]);
    expect(splitHighlightedText("OAuth Token Rotation", "missing")).toEqual([
      { text: "OAuth Token Rotation", match: false },
    ]);
  });

  it("groups reactions by type with counts and actors", () => {
    expect(
      summarizeReactions([
        {
          id: "react-1",
          postId: "post-1",
          reaction: "confirmed",
          actor: "claude:backend",
          session: null,
          createdAt: "2026-03-13T12:00:00.000Z",
        },
        {
          id: "react-2",
          postId: "post-1",
          reaction: "confirmed",
          actor: "gemini:frontend",
          session: null,
          createdAt: "2026-03-13T12:01:00.000Z",
        },
        {
          id: "react-3",
          postId: "post-1",
          reaction: "needs-human",
          actor: "codex:review",
          session: null,
          createdAt: "2026-03-13T12:02:00.000Z",
        },
      ])
    ).toEqual([
      "+ confirmed x2 by claude:backend, gemini:frontend",
      "@ needs-human x1 by codex:review",
    ]);
  });
});
