import type { Command } from "commander";

import { AgentForumError } from "../../../domain/errors.js";
import type { BrowseOptions } from "./types.js";
import { DEFAULT_REFRESH_MS } from "./types.js";

export function registerBrowseOptions(command: Command, defaults?: { includeIdOption?: boolean; defaultLimit?: string; defaultRefreshMs?: string }): Command {
  const includeIdOption = defaults?.includeIdOption ?? true;
  const defaultLimit = defaults?.defaultLimit ?? "30";
  const defaultRefreshMs = defaults?.defaultRefreshMs ?? `${DEFAULT_REFRESH_MS}`;

  let configured = command;

  if (includeIdOption) {
    configured = configured.option("--id <id>", "Open a specific thread immediately");
  }

  return configured
    .option("--channel <channel>", "Filter by channel")
    .option("--type <type>", "Filter by type")
    .option("--severity <severity>", "Filter by severity")
    .option("--status <status>", "Filter by status")
    .option("--tag <tag>", "Filter by tag")
    .option("--pinned", "Show only pinned posts")
    .option("--limit <number>", "Limit number of posts", defaultLimit)
    .option("--actor <actor>", "Actor identity used when replying")
    .option("--unread-for <session>", "Show only unread posts for a session")
    .option("--subscribed-for <actor>", "Show only posts matching subscriptions for an actor")
    .option("--assigned-to <actor>", "Show only posts assigned to an actor")
    .option("--waiting-for <actor>", "Show creator-owned threads waiting on review/acceptance")
    .option("--auto-refresh", "Refresh posts automatically while browsing")
    .option("--refresh-ms <number>", "Auto refresh interval in milliseconds", defaultRefreshMs);
}

export function parseLimit(rawLimit?: string): number {
  if (!rawLimit) {
    return 30;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new AgentForumError("--limit must be a positive integer.", 3);
  }

  return limit;
}

export function parseRefreshMs(rawRefreshMs?: string): number {
  if (!rawRefreshMs) {
    return DEFAULT_REFRESH_MS;
  }

  const refreshMs = Number(rawRefreshMs);
  if (!Number.isInteger(refreshMs) || refreshMs < 1000) {
    throw new AgentForumError("--refresh-ms must be an integer >= 1000.", 3);
  }

  return refreshMs;
}

export function toOpenBrowseOptions(id: string, options: { actor?: string; autoRefresh?: boolean; refreshMs?: string }): BrowseOptions {
  return {
    id,
    actor: options.actor,
    autoRefresh: options.autoRefresh,
    refreshMs: options.refreshMs
  };
}
