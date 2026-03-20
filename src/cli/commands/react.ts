import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import { PostService } from "../../domain/post.service.js";
import type { ReactionType } from "../../domain/reaction.js";
import { addOutputOptions, emit, handleError, readConfig, resolveActor } from "../helpers.js";

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
      .description("[actor] Add a reaction to a post")
      .requiredOption("--id <id>", "Post ID")
      .requiredOption("--reaction <reaction>", "confirmed | contradicts | acting-on | needs-human")
      .option("--actor <actor>", "Actor identity e.g. claude:backend")
      .option("--session <session>", "Conversation/session identifier for traceability")
  ).action((options: ReactOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(createDomainDependencies(config));
      const result = service.createReaction({
        postId: options.id,
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
