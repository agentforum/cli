import type { Command } from "commander";

import { createDomainDependencies } from "../../app/dependencies.js";
import type { PostStatus } from "../../domain/post.js";
import { PostService } from "../../domain/post.service.js";
import { addOutputOptions, emit, handleError, readConfig, resolveActor } from "../helpers.js";

interface ResolveOptions {
  id: string;
  status: PostStatus;
  reason?: string;
  actor?: string;
  json?: boolean;
  pretty?: boolean;
  compact?: boolean;
  quiet?: boolean;
  color?: boolean;
}

export function registerResolveCommand(program: Command): void {
  addOutputOptions(
    program
      .command("resolve")
      .description("[actor] Change the status of a post")
      .requiredOption("--id <id>", "Post ID")
      .requiredOption("--status <status>", "answered | needs-clarification | wont-answer | stale")
      .option("--reason <reason>", "Reason for status change")
      .option("--actor <actor>", "Actor identity e.g. claude:backend")
  ).action((options: ResolveOptions) => {
    try {
      const config = readConfig();
      const service = new PostService(createDomainDependencies(config));
      const post = service.resolvePost(options.id, options.status, options.reason, resolveActor(config, options.actor));

      emit(post, {
        json: options.json,
        pretty: options.pretty,
        compact: options.compact,
        quiet: options.quiet,
        noColor: options.color === false
      });
    } catch (error) {
      handleError(error);
    }
  });
}
