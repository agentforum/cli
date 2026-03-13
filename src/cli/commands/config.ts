import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { Command } from "commander";

import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";
import { findConfigSource, globalConfigPath } from "../../config.js";
import { AgentForumError } from "../../domain/types.js";

const LOCAL_CONFIG_DEFAULTS = {
  dbPath: ".forum/db.sqlite",
  backupDir: ".forum/backups",
  defaultChannel: "general",
  autoBackup: true,
  autoBackupInterval: 50,
  dateFormat: "iso"
};

const GLOBAL_CONFIG_DEFAULTS = {
  dbPath: ".forum/db.sqlite",
  backupDir: ".forum/backups",
  defaultChannel: "general",
  autoBackup: true,
  autoBackupInterval: 50,
  dateFormat: "iso"
};

interface OutputOptions {
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage AgentForum config");

  addOutputOptions(
    config
      .command("init")
      .description("Create an .afrc config file (~/.afrc by default, --local for project-specific)")
      .option("--local", "Write config to .afrc in the current directory instead of home dir")
      .option("--overwrite", "Overwrite the config file if it already exists")
  ).action((options: OutputOptions & { local?: boolean; overwrite?: boolean }) => {
    try {
      const targetPath = options.local ? resolve(process.cwd(), ".afrc") : globalConfigPath();
      const scope = options.local ? "local" : "global";

      if (existsSync(targetPath) && !options.overwrite) {
        const existing = JSON.parse(readFileSync(targetPath, "utf8")) as Record<string, unknown>;
        const hint = [
          `Config already exists at: ${targetPath}`,
          `Scope: ${scope}`,
          `Current contents:`,
          JSON.stringify(existing, null, 2),
          ``,
          `Run with --overwrite to replace it.`
        ].join("\n");
        throw new AgentForumError(hint, 5);
      }

      const defaults = options.local ? LOCAL_CONFIG_DEFAULTS : GLOBAL_CONFIG_DEFAULTS;
      writeJsonFile(targetPath, defaults);
      emit(
        { id: targetPath, scope, overwritten: options.overwrite ?? false },
        toOutputOptions(options)
      );
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    config.command("show").description("Show the resolved active configuration")
  ).action((options: OutputOptions) => {
    try {
      emit(readConfig({ silent: true }), { ...toOutputOptions(options), json: options.json ?? true });
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    config
      .command("set")
      .description("Set a config value (edits ~/.afrc by default, --local to edit project .afrc)")
      .requiredOption("--key <key>", "Config key")
      .requiredOption("--value <value>", "Config value")
      .option("--local", "Edit local .afrc in current directory instead of ~/.afrc")
  ).action((options: OutputOptions & { key: string; value: string; local?: boolean }) => {
    try {
      const path = options.local ? resolve(process.cwd(), ".afrc") : globalConfigPath();

      if (!existsSync(path)) {
        throw new AgentForumError(
          `Config file not found at: ${path}\nRun "af config init${options.local ? " --local" : ""}" first.`
        );
      }

      const current = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      current[options.key] = parseValue(options.value);
      writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`, "utf8");
      emit(current, { ...toOutputOptions(options), json: options.json ?? true });
    } catch (error) {
      handleError(error);
    }
  });

  addOutputOptions(
    config.command("which").description("Show which config file is active and its scope")
  ).action((options: OutputOptions) => {
    try {
      const source = findConfigSource(process.cwd());
      const cfg = readConfig({ silent: true });

      if (source.scope === "default") {
        process.stderr.write(
          [
            "No config file found. Using built-in defaults.",
            "  Run `af config init` to create a global config (~/.afrc).",
            "  Run `af config init --local` to create a project-specific config (.afrc).",
            ""
          ].join("\n")
        );
      }

      emit(
        {
          configFile: source.scope === "default" ? "(none — using defaults)" : source.filepath,
          scope: source.scope,
          dbPath: cfg.dbPath,
          backupDir: cfg.backupDir
        },
        { ...toOutputOptions(options), pretty: options.pretty ?? !options.json }
      );
    } catch (error) {
      handleError(error);
    }
  });
}

function toOutputOptions(options: OutputOptions) {
  return {
    json: options.json,
    pretty: options.pretty,
    compact: options.compact,
    quiet: options.quiet,
    noColor: options.color === false
  };
}

function writeJsonFile(path: string, data: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function parseValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (!Number.isNaN(Number(value)) && value.trim() !== "") return Number(value);
  return value;
}
