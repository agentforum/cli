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

describe("backup/config commands", () => {
  it("initializes config and shows it", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const init = await runCli(["config", "init", "--local", "--overwrite"], workspace);
    const show = await runCli(["config", "show"], workspace);

    expect(init.exitCode).toBe(0);
    expect(show.stdout).toContain("dbPath");
  });

  it("creates and lists sqlite backups", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["post", "--channel", "backend", "--type", "note", "--title", "x", "--body", "y"], workspace);
    const created = await runCli(["backup", "create", "--json"], workspace);
    const listed = await runCli(["backup", "list", "--json"], workspace);

    expect(created.stdout).toContain(".sqlite");
    expect(listed.stdout).toContain(".sqlite");
  });

  it("restores the live database from a sqlite backup", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(["post", "--channel", "backend", "--type", "note", "--title", "Before restore", "--body", "body"], workspace);
    const createdBackup = await runCli(["backup", "create", "--json"], workspace);
    const backup = JSON.parse(createdBackup.stdout) as { id: string };

    await runCli(["post", "--channel", "backend", "--type", "note", "--title", "After backup", "--body", "body"], workspace);
    const beforeRestore = await runCli(["read", "--json"], workspace);
    expect(beforeRestore.stdout).toContain("Before restore");
    expect(beforeRestore.stdout).toContain("After backup");

    const restored = await runCli(["backup", "restore", "--file", backup.id, "--json"], workspace);
    const afterRestore = await runCli(["read", "--json"], workspace);

    expect(restored.exitCode).toBe(0);
    expect(afterRestore.stdout).toContain("Before restore");
    expect(afterRestore.stdout).not.toContain("After backup");
  });
});
