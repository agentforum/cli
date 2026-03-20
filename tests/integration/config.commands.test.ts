import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AgentForumConfig } from "../../src/domain/types.js";
import { runCli } from "../cli-test-helpers.js";
import {
  cleanupTestConfig,
  createTestConfig,
  writeWorkspaceConfig,
  createBareWorkspace,
} from "../test-helpers.js";

let config: AgentForumConfig | undefined;

afterEach(() => {
  if (config) {
    cleanupTestConfig(config);
    config = undefined;
  }
});

describe("config init", () => {
  it("creates a local .afrc when --local is passed", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    // remove the existing .afrc so init can create a fresh one
    rmSync(join(workspace, ".afrc"), { force: true });

    const result = await runCli(["config", "init", "--local"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("local");
    expect(existsSync(join(workspace, ".afrc"))).toBe(true);
  });

  it("refuses to overwrite an existing config without --overwrite", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    // .afrc already exists from writeWorkspaceConfig
    const result = await runCli(["config", "init", "--local"], workspace);

    expect(result.exitCode).toBe(5);
    expect(result.stderr).toContain("already exists");
    expect(result.stderr).toContain(join(workspace, ".afrc"));
  });

  it("shows current file contents in the warning when config already exists", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["config", "init", "--local"], workspace);

    expect(result.exitCode).toBe(5);
    expect(result.stderr).toContain("dbPath");
    expect(result.stderr).toContain("--overwrite");
  });

  it("overwrites an existing config when --overwrite is passed", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    // Put something non-standard in the existing config
    writeFileSync(
      join(workspace, ".afrc"),
      JSON.stringify({ dbPath: "custom/path.sqlite" }),
      "utf8"
    );

    const result = await runCli(["config", "init", "--local", "--overwrite"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("overwritten");

    const written = JSON.parse(readFileSync(join(workspace, ".afrc"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(written.dbPath).toBe(".forum/db.sqlite");
  });

  it("reports overwritten: false when creating for the first time", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);
    rmSync(join(workspace, ".afrc"), { force: true });

    const result = await runCli(["config", "init", "--local", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { overwritten: boolean };
    expect(parsed.overwritten).toBe(false);
  });

  it("reports overwritten: true after forced overwrite", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["config", "init", "--local", "--overwrite", "--json"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as { overwritten: boolean };
    expect(parsed.overwritten).toBe(true);
  });
});

describe("config show", () => {
  it("shows the resolved config as JSON", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["config", "show"], workspace);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed).toHaveProperty("dbPath");
    expect(parsed).toHaveProperty("backupDir");
    expect(parsed).toHaveProperty("autoBackup");
  });
});

describe("config set", () => {
  it("updates a key in the local config", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(
      ["config", "set", "--key", "defaultActor", "--value", "claude:backend", "--local"],
      workspace
    );

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.defaultActor).toBe("claude:backend");

    const onDisk = JSON.parse(readFileSync(join(workspace, ".afrc"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(onDisk.defaultActor).toBe("claude:backend");
  });

  it("coerces boolean values correctly", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["config", "set", "--key", "autoBackup", "--value", "false", "--local"],
      workspace
    );

    const onDisk = JSON.parse(readFileSync(join(workspace, ".afrc"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(onDisk.autoBackup).toBe(false);
  });

  it("coerces numeric values correctly", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    await runCli(
      ["config", "set", "--key", "autoBackupInterval", "--value", "100", "--local"],
      workspace
    );

    const onDisk = JSON.parse(readFileSync(join(workspace, ".afrc"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(onDisk.autoBackupInterval).toBe(100);
  });

  it("fails with a clear message when target config file does not exist", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);
    rmSync(join(workspace, ".afrc"), { force: true });

    const result = await runCli(
      ["config", "set", "--key", "defaultActor", "--value", "x", "--local"],
      workspace
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not found");
    expect(result.stderr).toContain("config init");
  });
});

describe("config which", () => {
  it("reports local scope when .afrc is in the workspace", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["config", "which"], workspace);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("local");
    expect(result.stdout).toContain(".afrc");
  });

  it("includes resolved dbPath and backupDir", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["config", "which"], workspace);

    expect(result.stdout).toContain("dbPath");
    expect(result.stdout).toContain("backupDir");
  });

  it("shows default scope and setup hint when no config exists", async () => {
    const workspace = createBareWorkspace();

    try {
      const result = await runCli(["config", "which"], workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("No config file found");
      expect(result.stderr).toContain("af config init");
      expect(result.stdout).toContain("default");
      expect(result.stdout).toContain("none");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("no-config warning on operational commands", () => {
  it("warns on stderr when running post without any config", async () => {
    const workspace = createBareWorkspace();

    try {
      const result = await runCli(
        [
          "post",
          "--channel",
          "backend",
          "--type",
          "note",
          "--title",
          "test",
          "--body",
          "body",
          "--json",
        ],
        workspace
      );

      expect(result.stderr).toContain("No AgentForum config found");
      expect(result.stderr).toContain("af config init");
      // Command still works — warning does not block
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("note");
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("warns on stderr when running read without any config", async () => {
    const workspace = createBareWorkspace();

    try {
      const result = await runCli(["read", "--json"], workspace);

      expect(result.stderr).toContain("No AgentForum config found");
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("does NOT warn when a local config exists", async () => {
    config = createTestConfig();
    const workspace = writeWorkspaceConfig(config);

    const result = await runCli(["read", "--json"], workspace);

    expect(result.stderr).not.toContain("No AgentForum config found");
    expect(result.exitCode).toBe(0);
  });

  it("config show does NOT warn even with no config (it is the setup command)", async () => {
    const workspace = createBareWorkspace();

    try {
      const result = await runCli(["config", "show"], workspace);

      expect(result.stderr).not.toContain("No AgentForum config found");
      expect(result.exitCode).toBe(0);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
