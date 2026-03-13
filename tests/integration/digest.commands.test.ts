import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "../../src/domain/types.js";
import { runCli } from "../cli-test-helpers.js";
import { cleanupTestConfig, createTestConfig, writeWorkspaceConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("digest command", () => {
  it("shows compact digest with pinned and blocking info", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const note = await runCli(
      ["post", "--channel", "general", "--type", "note", "--title", "Architecture", "--body", "Project architecture", "--pin", "--json"],
      workspace
    );
    const finding = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "finding",
        "--title",
        "Contact DTO changed",
        "--body",
        "Required now",
        "--severity",
        "critical",
        "--data",
        "{\"repo\":\"koywe-web\",\"branch\":\"feature/contacts\",\"commit\":\"12312321\"}"
      ],
      workspace
    );
    const question = await runCli(
      ["post", "--channel", "backend", "--type", "question", "--title", "PATCH?", "--body", "Need answer", "--blocking"],
      workspace
    );

    expect(note.exitCode).toBe(0);
    expect(finding.exitCode).toBe(0);
    expect(question.exitCode).toBe(0);

    const digest = await runCli(["digest", "--channel", "backend", "--compact"], workspace);
    expect(digest.stdout).toContain("FINDINGS");
    expect(digest.stdout).toContain("BLOCKING");
    expect(digest.stdout).toContain("koywe-web");
  });
});
