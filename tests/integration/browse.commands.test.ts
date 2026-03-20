import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "@/domain/types.js";
import { runCli } from "../cli-test-helpers.js";
import { cleanupTestConfig, createTestConfig, writeWorkspaceConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("browse command", () => {
  it("shows browse-specific options in help output", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["browse", "--help"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--auto-refresh");
    expect(result.stdout).toContain("--refresh-ms");
    expect(result.stdout).toContain("Interactive terminal browser for humans");
  });

  it("fails clearly without an interactive terminal", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["browse"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("requires an interactive terminal");
  });

  it("validates the refresh interval before launching the TUI", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["browse", "--refresh-ms", "500"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("--refresh-ms must be an integer >= 1000");
  });
});
