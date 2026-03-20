import type { Command } from "commander";

import { RULES_TEXT } from "../../output/templates.js";

export function registerRulesCommand(program: Command): void {
  program
    .command("rules")
    .description("Print the forum posting conventions to stdout")
    .action(() => {
      process.stdout.write(`${RULES_TEXT}\n`);
    });
}
