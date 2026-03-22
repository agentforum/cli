import { afterEach, describe, expect, it } from "vitest";

import { formatEntity, resolveOutputMode } from "@/output/formatter.js";

const POST = {
  id: "P-123",
  channel: "backend",
  type: "finding" as const,
  title: "Token refresh regression",
  body: "Refresh tokens stop working after 15 minutes.",
  data: {
    repo: "crew-ai",
    branch: "feature/tokens",
    commit: "abcdef1234567890",
  },
  severity: "critical" as const,
  status: "open" as const,
  actor: "claude:backend",
  session: "be-run-001",
  tags: ["auth", "tokens"],
  pinned: true,
  refId: null,
  blocking: true,
  assignedTo: "claude:frontend",
  idempotencyKey: null,
  createdAt: "2026-03-17T10:00:00.000Z",
};

const BUNDLE = {
  post: POST,
  totalReplies: 1,
  reactions: [],
  replyReactions: [
    {
      id: "X-1",
      postId: "P-123",
      targetType: "reply" as const,
      targetId: "R-1",
      reaction: "confirmed" as const,
      actor: "claude:review",
      session: null,
      createdAt: "2026-03-17T10:06:00.000Z",
    },
  ],
  replies: [
    {
      id: "R-1",
      postId: "P-123",
      body: "Agree with the original thread.",
      data: {
        quoteRefs: [
          {
            id: "P-123",
            kind: "post" as const,
            label: "Original post",
            author: "claude:backend",
            replyIndex: -1,
          },
        ],
      },
      actor: "gemini:frontend",
      session: null,
      createdAt: "2026-03-17T10:05:00.000Z",
    },
  ],
};

const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

function setStdoutIsTTY(value: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value });
}

afterEach(() => {
  if (originalIsTTY) {
    Object.defineProperty(process.stdout, "isTTY", originalIsTTY);
  }
});

describe("output formatter", () => {
  it("resolves output mode by explicit flag priority", () => {
    setStdoutIsTTY(true);

    expect(resolveOutputMode({ quiet: true, compact: true, json: true, pretty: true })).toBe(
      "quiet"
    );
    expect(resolveOutputMode({ compact: true, json: true, pretty: true })).toBe("compact");
    expect(resolveOutputMode({ json: true, pretty: true })).toBe("json");
    expect(resolveOutputMode({ pretty: true })).toBe("pretty");
  });

  it("falls back to pretty in a TTY and json outside a TTY", () => {
    setStdoutIsTTY(true);
    expect(resolveOutputMode({})).toBe("pretty");

    setStdoutIsTTY(false);
    expect(resolveOutputMode({})).toBe("json");
  });

  it("formats quiet output using entity ids", () => {
    expect(formatEntity(POST, { quiet: true })).toBe("P-123\n");
    expect(formatEntity("hello", { quiet: true })).toBe("hello\n");
  });

  it("formats compact post lists with tags and project metadata", () => {
    const output = formatEntity([POST], { compact: true });

    expect(output).toContain("[P-123] FINDING CRITICAL BLOCKING #auth #tokens");
    expect(output).toContain("owner:claude:frontend");
    expect(output).toContain("session:be-run-001");
    expect(output).toContain("crew-ai feature/tokens commit:abcdef12");
  });

  it("formats pretty output with the ASCII banner and no ANSI escapes when noColor is set", () => {
    setStdoutIsTTY(true);

    const output = formatEntity(POST, { pretty: true, noColor: true });

    expect(output).toContain("_                    _   _____");
    expect(output).toContain("Token refresh regression");
    expect(output).not.toContain("\u001b[");
  });

  it("formats reply quote refs in bundle output", () => {
    const output = formatEntity(BUNDLE, { pretty: true, noColor: true });

    expect(output).toContain("Replies (1)");
    expect(output).toContain("refs: Original post (P-123) by claude:backend");
    expect(output).toContain("Reply reactions");
    expect(output).toContain("confirmed on reply R-1 by claude:review");
  });
});
