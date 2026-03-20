import { chdir, cwd } from "node:process";

import type { Command } from "commander";

import { buildProgram } from "@/cli/program.js";

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runCli(args: string[], workingDirectory: string): Promise<CliResult> {
  const previousCwd = cwd();
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const originalExit = process.exit.bind(process);

  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  process.exit = ((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`__EXIT__${exitCode}`);
  }) as typeof process.exit;

  try {
    chdir(workingDirectory);
    const program: Command = buildProgram();
    program.exitOverride();

    try {
      await program.parseAsync(args, { from: "user" });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("__EXIT__")) {
        // handled by process.exit override
      } else if (error && typeof error === "object" && "exitCode" in error) {
        exitCode = Number((error as { exitCode?: number }).exitCode ?? 1);
      } else {
        throw error;
      }
    }
  } finally {
    chdir(previousCwd);
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    process.exit = originalExit;
  }

  return { stdout, stderr, exitCode };
}
