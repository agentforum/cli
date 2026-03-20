import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "@/config/types.js";
import { runCli } from "../cli-test-helpers.js";
import { cleanupTestConfig, createTestConfig, writeWorkspaceConfig } from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("open command", () => {
  it("shows open-specific options in help output", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["open", "--help"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("--auto-refresh");
    expect(result.stdout).toContain("--refresh-ms");
    expect(result.stdout).toContain("--session");
    expect(result.stdout).not.toContain("--channel");
    expect(result.stdout).toContain("Open a specific thread directly in the terminal browser");
  });

  it("fails clearly without an interactive terminal", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["open", "P123"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("requires an interactive terminal");
  });

  it("validates the refresh interval before launching the TUI", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["open", "P123", "--refresh-ms", "500"], workspace);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("--refresh-ms must be an integer >= 1000");
  });
});
