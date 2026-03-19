import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { homedir } from "node:os";

import { cosmiconfigSync } from "cosmiconfig";

import type { AgentForumConfig } from "./config/types.js";

const SEARCH_PLACES = [".afrc", ".afrc.json", "af.config.json"];

const DEFAULT_CONFIG: AgentForumConfig = {
  dbPath: ".forum/db.sqlite",
  backupDir: ".forum/backups",
  defaultActor: undefined,
  defaultChannel: "general",
  autoBackup: true,
  autoBackupInterval: 50,
  dateFormat: "iso"
};

export interface ConfigSource {
  filepath: string;
  scope: "local" | "global" | "default";
}

function findConfigResult(cwd: string): { result: ReturnType<ReturnType<typeof cosmiconfigSync>["search"]>; scope: "local" | "global" | "default" } {
  const home = homedir();

  // Search from cwd upward. cosmiconfig's stopDir is inclusive so home itself
  // is still checked — we filter it out by requiring the result lives outside home.
  const anyResult = cosmiconfigSync("af", { searchPlaces: SEARCH_PLACES, stopDir: home }).search(cwd);

  if (anyResult) {
    const inHome = dirname(anyResult.filepath) === home;
    return { result: anyResult, scope: inHome ? "global" : "local" };
  }

  return { result: null, scope: "default" };
}

export function loadConfig(cwd = process.cwd()): AgentForumConfig {
  const { result } = findConfigResult(cwd);
  // Without a config file, built-in defaults should stay workspace-scoped so
  // ad-hoc use writes into the current repo instead of the user's home dir.
  const configDir = result ? dirname(result.filepath) : cwd;

  const config = {
    ...DEFAULT_CONFIG,
    ...(result?.config ?? {})
  } satisfies AgentForumConfig;

  config.dbPath = resolve(configDir, config.dbPath);
  config.backupDir = resolve(configDir, config.backupDir);

  ensureDirectory(dirname(config.dbPath));
  ensureDirectory(config.backupDir);

  return config;
}

export function findConfigSource(cwd = process.cwd()): ConfigSource {
  const home = homedir();
  const { result, scope } = findConfigResult(cwd);
  return {
    filepath: result?.filepath ?? resolve(home, ".afrc"),
    scope
  };
}

export function globalConfigPath(): string {
  return resolve(homedir(), ".afrc");
}

export function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export function getDefaultActor(config: AgentForumConfig, actor?: string): string | undefined {
  return actor ?? config.defaultActor;
}

export function getDefaultChannel(config: AgentForumConfig, channel?: string): string {
  return channel ?? config.defaultChannel ?? "general";
}
