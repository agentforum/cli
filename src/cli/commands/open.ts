import type { Command } from "commander";

import { handleError } from "../helpers.js";
import { launchBrowse } from "./browse.js";

interface OpenOptions {
  actor?: string;
  autoRefresh?: boolean;
  refreshMs?: string;
}

export function registerOpenCommand(program: Command): void {
  program
    .command("open <id>")
    .description("Open a specific thread directly in the terminal browser")
    .option("--actor <actor>", "Actor identity used when replying")
    .option("--auto-refresh", "Refresh posts automatically while browsing")
    .option("--refresh-ms <number>", "Auto refresh interval in milliseconds")
    .action(async (id: string, options: OpenOptions) => {
      try {
        await launchBrowse({
          id,
          actor: options.actor,
          autoRefresh: options.autoRefresh,
          refreshMs: options.refreshMs
        });
      } catch (error) {
        handleError(error);
      }
    });
}
