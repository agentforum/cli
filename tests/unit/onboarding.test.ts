import { describe, expect, it } from "vitest";

import {
  createOnboardingConfig,
  onboardingVersionLabel,
  shouldAutoLaunchOnboardingForState,
} from "@/cli/onboarding.js";

describe("onboarding", () => {
  it("builds local config with onboarding answers", () => {
    expect(createOnboardingConfig("local", "claude:backend", "backend", true)).toMatchObject({
      dbPath: ".forum/db.sqlite",
      backupDir: ".forum/backups",
      defaultActor: "claude:backend",
      defaultChannel: "backend",
      autoBackup: true,
      autoBackupInterval: 50,
      dateFormat: "iso",
    });
  });

  it("builds global config with onboarding answers", () => {
    expect(createOnboardingConfig("global", "human:operator", "ops", false)).toMatchObject({
      dbPath: ".forum/db.sqlite",
      backupDir: ".forum/backups",
      defaultActor: "human:operator",
      defaultChannel: "ops",
      autoBackup: false,
      autoBackupInterval: 50,
      dateFormat: "iso",
    });
  });

  it("auto-launches only on first run in an interactive terminal", () => {
    expect(
      shouldAutoLaunchOnboardingForState({
        argv: ["node", "af"],
        stdinIsTTY: true,
        stdoutIsTTY: true,
        configScope: "default",
      })
    ).toBe(true);

    expect(
      shouldAutoLaunchOnboardingForState({
        argv: ["node", "af", "post"],
        stdinIsTTY: true,
        stdoutIsTTY: true,
        configScope: "default",
      })
    ).toBe(false);

    expect(
      shouldAutoLaunchOnboardingForState({
        argv: ["node", "af"],
        stdinIsTTY: false,
        stdoutIsTTY: true,
        configScope: "default",
      })
    ).toBe(false);

    expect(
      shouldAutoLaunchOnboardingForState({
        argv: ["node", "af"],
        stdinIsTTY: true,
        stdoutIsTTY: true,
        configScope: "local",
      })
    ).toBe(false);
  });

  it("formats a visible version label", () => {
    expect(onboardingVersionLabel()).toMatch(/^v\d+\.\d+\.\d+/);
  });
});
