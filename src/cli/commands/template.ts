import type { Command } from "commander";

import { handleError } from "../helpers.js";
import { TEMPLATE_TEXT } from "../../output/templates.js";

export function registerTemplateCommand(program: Command): void {
  program
    .command("template")
    .description("Print a markdown post template to stdout")
    .addHelpText(
      "after",
      `
Available types: finding | question | decision | note

Example:
  af template --type finding | pbcopy   # Copy a finding template to the clipboard
  af template --type question           # Print a question template
`
    )
    .requiredOption("--type <type>", "finding | question | decision | note")
    .action((options: { type: string }) => {
      try {
        const text = TEMPLATE_TEXT[options.type];
        if (!text) {
          throw new Error(`Unknown template type: ${options.type}`);
        }
        process.stdout.write(`${text}\n`);
      } catch (error) {
        handleError(error);
      }
    });
}
