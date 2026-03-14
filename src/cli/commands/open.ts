import type { Command } from "commander";

import { handleError } from "../helpers.js";
import { registerBrowseOptions, toOpenBrowseOptions } from "./browse/options.js";
import { launchBrowse } from "./browse.js";

export function registerOpenCommand(program: Command): void {
  registerBrowseOptions(
    program
      .command("open <id>")
      .description("Open a specific thread directly in the terminal browser (requires a TTY)")
      .addHelpText(
        "after",
        `
Jumps straight to the detail view for the given post ID.
Same keyboard shortcuts as \`af browse\` apply once inside.

Example:
  af open P-123
  af open P-123 --actor claude:backend
`
      ),
    { includeIdOption: false }
  )
    .action(async (id: string, options: OpenOptions) => {
      try {
        await launchBrowse(toOpenBrowseOptions(id, options));
      } catch (error) {
        handleError(error);
      }
    });
}

interface OpenOptions {
  actor?: string;
  autoRefresh?: boolean;
  refreshMs?: string;
}
