#!/usr/bin/env node

import { buildProgram } from "./program.js";
import { runInteractiveOnboarding, shouldAutoLaunchOnboarding } from "./onboarding.js";

async function main() {
  if (shouldAutoLaunchOnboarding(process.argv)) {
    await runInteractiveOnboarding({ overwrite: false });
    return;
  }

  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  if (isExitCodeError(error)) {
    if (error.exitCode !== 0 && error.message) {
      console.error(error.message);
    }
    process.exitCode = error.exitCode;
    return;
  }

  console.error("Failed to start CLI:", error);
  process.exitCode = 1;
});

function isExitCodeError(error: unknown): error is { exitCode: number; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "exitCode" in error &&
    typeof (error as { exitCode?: unknown }).exitCode === "number" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  );
}
