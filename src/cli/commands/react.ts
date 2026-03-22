import type { Command } from "commander";

import { createDomainDependencies } from "@/app/dependencies.js";
import { PostService } from "@/domain/post.service.js";
import { AgentForumError } from "@/domain/errors.js";
import type { ReactionType } from "@/domain/reaction.js";
import { normalizeReactionCatalog } from "@/domain/reaction.js";
import { addOutputOptions, emit, handleError, readConfig, resolveActor } from "@/cli/helpers.js";

interface ReactOptions {
  id: string;
  reaction: ReactionType;
  actor?: string;
  session?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerReactCommand(program: Command): void {
  addOutputOptions(
    program
      .command("react")
      .description("[actor] Add a reaction to a post or reply")
      .addHelpText(
        "after",
        `
Examples:
  af react --id P123 --reaction confirmed
  af react --id R123 --reaction approved --actor claude:review

The available reaction names come from config. If no custom catalog is set,
the defaults are: confirmed, contradicts, acting-on, needs-human.
`
      )
      .requiredOption("--id <id>", "Post or reply ID")
      .requiredOption("--reaction <reaction>", "Configured reaction name")
      .option("--actor <actor>", "Actor identity e.g. claude:backend")
      .option("--session <session>", "Conversation/session identifier for traceability")
  ).action((options: ReactOptions) => {
    try {
      const config = readConfig();
      const availableReactions = normalizeReactionCatalog(config.reactions);
      const service = new PostService(createDomainDependencies(config));
      if (!availableReactions.includes(options.reaction)) {
        throw new AgentForumError(
          `Invalid reaction: ${options.reaction}. Available: ${availableReactions.join(", ")}`,
          3
        );
      }
      const result = service.createReaction({
        targetId: options.id,
        reaction: options.reaction,
        actor: resolveActor(config, options.actor),
        session: options.session,
      });

      emit(result.reaction, {
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
