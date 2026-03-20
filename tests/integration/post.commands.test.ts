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

describe("post command", () => {
  it("creates a finding and emits JSON", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "finding",
        "--title",
        "Contact DTO changed",
        "--body",
        "phoneNumber is now required",
        "--severity",
        "critical",
        "--data",
        '{"field":"phoneNumber"}',
        "--json",
      ],
      workspace
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"type": "finding"');
    expect(result.stdout).toContain('"severity": "critical"');
  });

  it("returns exit code 3 for invalid JSON in data", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      [
        "post",
        "--channel",
        "backend",
        "--type",
        "finding",
        "--title",
        "Broken data",
        "--body",
        "oops",
        "--severity",
        "critical",
        "--data",
        "{broken",
      ],
      workspace
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Invalid JSON in --data");
  });
});
