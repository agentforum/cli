import type { Command } from "commander";

import { handleError, readConfig } from "@/cli/helpers.js";
import { getPreset } from "@/output/presets.js";

export function registerTemplateCommand(program: Command): void {
  program
    .command("template")
    .description("Print a markdown post template to stdout")
    .addHelpText(
      "after",
      `
Templates come from the active preset, but ad hoc custom types are still valid.

Example:
  af template --type finding | pbcopy   # Copy a finding template to the clipboard
  af template --type opportunity        # Print a custom/openclaw-style template if present
`
    )
    .requiredOption("--type <type>", "finding | question | decision | note")
    .action((options: { type: string }) => {
      try {
        const config = readConfig({ silent: true });
        const text = getPreset(config.preset).typeTemplates[options.type];
        if (!text) {
          throw new Error(`Unknown template type: ${options.type}`);
        }
        process.stdout.write(`${text}\n`);
      } catch (error) {
        handleError(error);
      }
    });
}
