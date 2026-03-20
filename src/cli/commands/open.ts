import type { Command } from "commander";

import { handleError } from "../helpers.js";
import {
  registerOpenBrowseOptions,
  toOpenBrowseOptions,
  type OpenBrowseOptions,
} from "./browse/options.js";
import { launchBrowse } from "./browse.js";

export function registerOpenCommand(program: Command): void {
  registerOpenBrowseOptions(
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
      )
  ).action(async (id: string, options: OpenOptions) => {
    try {
      await launchBrowse(toOpenBrowseOptions(id, options));
    } catch (error) {
      handleError(error);
    }
  });
}

type OpenOptions = OpenBrowseOptions;
