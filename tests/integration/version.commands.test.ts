import { rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import pkg from "../../package.json" with { type: "json" };
import { runCli } from "../cli-test-helpers.js";
import { createBareWorkspace } from "../test-helpers.js";

describe("version", () => {
  it("reports the package version", async () => {
    const workspace = createBareWorkspace();

    try {
      const result = await runCli(["--version"], workspace);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(pkg.version);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});
