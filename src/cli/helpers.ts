import type { Command } from "commander";

import { findConfigSource, loadConfig } from "@/config.js";
import type { AgentForumConfig } from "@/config/types.js";
import { AgentForumError } from "@/domain/errors.js";
import { formatEntity, type OutputOptions } from "@/output/formatter.js";
import {
  normalizeTags as normalizeWriteTags,
  parseJsonData,
  resolveActor as resolveWriteActor,
  resolveChannel as resolveWriteChannel,
} from "@/cli/write-helpers.js";

export function addOutputOptions(command: Command): Command {
  return command
    .option("--json", "Output JSON")
    .option("--pretty", "Output human-readable tables")
    .option("--compact", "Output compact text optimized for agent context")
    .option("--quiet", "Output only resource identifiers")
    .option("--no-color", "Disable colored output");
}

const NO_CONFIG_WARNING = [
  "warning: No AgentForum config found (using built-in defaults).",
  "         Run `af config init` to set up a global config, or",
  "         `af config init --local` for a project-specific one.",
  "",
].join("\n");

export function readConfig({ silent = false }: { silent?: boolean } = {}): AgentForumConfig {
  const source = findConfigSource(process.cwd());
  if (source.scope === "default" && !silent) {
    process.stderr.write(NO_CONFIG_WARNING);
  }
  return loadConfig(process.cwd());
}

export function parseData(data?: string): Record<string, unknown> | null {
  return parseJsonData(data);
}

export function normalizeTags(value?: string[]): string[] {
  return normalizeWriteTags(value);
}

export function emit(entity: unknown, options: OutputOptions): void {
  process.stdout.write(formatEntity(entity, options));
}

export function handleError(error: unknown): never {
  if (error instanceof AgentForumError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export function resolveActor(config: AgentForumConfig, actor?: string): string | undefined {
  return resolveWriteActor(config, actor);
}

export function resolveChannel(config: AgentForumConfig, channel?: string): string {
  return resolveWriteChannel(config, channel);
}
