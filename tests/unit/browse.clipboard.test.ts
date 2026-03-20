import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyContextPack, copyToClipboard } from "../../src/cli/commands/browse/clipboard.js";
import { BUNDLE } from "./browse.fixtures.js";
import type { ConversationItem } from "../../src/cli/commands/browse/types.js";

const visibleItems: ConversationItem[] = [
  {
    id: "R-1",
    kind: "reply",
    label: "Reply 1",
    body: "First reply body",
    actor: "claude:backend",
    session: null,
    replyIndex: 0,
    createdAt: "2026-03-13T12:05:00.000Z",
  },
  {
    id: "R-2",
    kind: "reply",
    label: "Reply 2",
    body: "Second reply body",
    actor: "claude:frontend",
    session: null,
    replyIndex: 1,
    createdAt: "2026-03-13T12:10:00.000Z",
  },
];

describe("clipboard", () => {
  let writtenOutput: string;

  beforeEach(() => {
    writtenOutput = "";
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writtenOutput += chunk.toString();
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copyToClipboard writes OSC 52 sequence to stdout", () => {
    copyToClipboard("hello world");

    expect(writtenOutput).toContain("\x1b]52;c;");
    const b64 = Buffer.from("hello world").toString("base64");
    expect(writtenOutput).toContain(b64);
    expect(writtenOutput).toContain("\x07");
  });

  it("copyContextPack includes thread title and post body", () => {
    copyContextPack(BUNDLE, visibleItems, "claude:backend");

    const decoded = Buffer.from(
      writtenOutput.match(/\x1b\]52;c;([A-Za-z0-9+/=]+)\x07/)![1],
      "base64"
    ).toString("utf-8");

    expect(decoded).toContain("Original thread");
    expect(decoded).toContain("Original body");
  });

  it("copyContextPack includes visible reply bodies", () => {
    copyContextPack(BUNDLE, visibleItems, "claude:backend");

    const decoded = Buffer.from(
      writtenOutput.match(/\x1b\]52;c;([A-Za-z0-9+/=]+)\x07/)![1],
      "base64"
    ).toString("utf-8");

    expect(decoded).toContain("First reply body");
    expect(decoded).toContain("Second reply body");
  });

  it("copyContextPack includes ready-to-use CLI commands referencing the post id", () => {
    copyContextPack(BUNDLE, visibleItems, "claude:backend");

    const decoded = Buffer.from(
      writtenOutput.match(/\x1b\]52;c;([A-Za-z0-9+/=]+)\x07/)![1],
      "base64"
    ).toString("utf-8");

    expect(decoded).toContain(`af reply --post ${BUNDLE.post.id}`);
    expect(decoded).toContain(`af react --id ${BUNDLE.post.id} --reaction confirmed`);
    expect(decoded).toContain(`af resolve --id ${BUNDLE.post.id} --status answered`);
    expect(decoded).toContain(`af assign --id ${BUNDLE.post.id} --actor <agent>`);
  });

  it("copyContextPack includes post metadata (channel, status, tags)", () => {
    const bundleWithTags = {
      ...BUNDLE,
      post: { ...BUNDLE.post, channel: "backend", status: "open" as const, tags: ["auth", "api"] },
    };

    copyContextPack(bundleWithTags, [], "claude:backend");

    const decoded = Buffer.from(
      writtenOutput.match(/\x1b\]52;c;([A-Za-z0-9+/=]+)\x07/)![1],
      "base64"
    ).toString("utf-8");

    expect(decoded).toContain("#backend");
    expect(decoded).toContain("open");
    expect(decoded).toContain("#auth");
    expect(decoded).toContain("#api");
  });

  it("copyContextPack shows (none) when there are no tags", () => {
    copyContextPack(BUNDLE, [], "claude:backend");

    const decoded = Buffer.from(
      writtenOutput.match(/\x1b\]52;c;([A-Za-z0-9+/=]+)\x07/)![1],
      "base64"
    ).toString("utf-8");

    expect(decoded).toContain("(none)");
  });
});
