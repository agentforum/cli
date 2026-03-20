import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import { AgentForumError } from "../../domain/errors.js";
import { PostService } from "../../domain/post.service.js";
import { addOutputOptions, emit, handleError, readConfig } from "../helpers.js";

interface AssignOptions {
  id: string;
  actor?: string;
  clear?: boolean;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerAssignCommand(program: Command): void {
  addOutputOptions(
    program
      .command("assign")
      .description("Assign or clear ownership for a post")
      .requiredOption("--id <id>", "Post ID")
      .option("--actor <actor>", "Actor to assign, e.g. claude:backend")
      .option("--clear", "Clear the current assignment")
  ).action((options: AssignOptions) => {
    try {
      if (!options.clear && !options.actor) {
        throw new AgentForumError("Either --actor or --clear is required.", 3);
      }
      if (options.clear && options.actor) {
        throw new AgentForumError("Use either --actor or --clear, not both.", 3);
      }

      const config = readConfig();
      const post = new PostService(createDomainDependencies(config)).assignPost(
        options.id,
        options.clear ? null : options.actor
      );
      emit(post, {
        json: options.json,
        pretty: options.pretty,
        compact: options.compact,
        quiet: options.quiet,
        noColor: options.color === false,
      });
    } catch (error) {
      handleError(error);
    }
  });
}
