#!/usr/bin/env node

import { buildProgram } from "./program.js";

async function main() {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error("Failed to start CLI:", error);
  process.exitCode = 1;
});
